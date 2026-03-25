import sqlite3
import time
import logging
import os
import requests as req

logger = logging.getLogger('backup_worker')
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(name)s %(levelname)s %(message)s')


def run(db_path: str):
    dt_url = os.environ['DT_URL'].rstrip('/')
    library_id = os.environ.get('DT_LIBRARY_ID', 'main')
    username = os.environ.get('DT_USERNAME', '')
    password = os.environ.get('DT_PASSWORD', '')

    session = req.Session()

    def login():
        try:
            session.post(
                f'{dt_url}/',
                data={
                    'username': username,
                    'password': password,
                    'redirectBackTo': f'{dt_url}/?library={library_id}',
                },
                timeout=10,
                allow_redirects=True,
            )
            logger.info('Logged in to DT')
        except Exception as e:
            logger.error(f'DT login failed: {e}')

    def is_login_page(resp):
        return 'text/html' in resp.headers.get('content-type', '')

    def post_timeline(payload):
        resp = session.post(f'{dt_url}/timeline', json=payload, timeout=10)
        if is_login_page(resp):
            login()
            resp = session.post(f'{dt_url}/timeline', json=payload, timeout=10)
        resp.raise_for_status()
        return resp.json()

    def post_tag(timeline_id, tag):
        payload = {'libraryId': library_id, 'op': 'add', 'tag': tag, 'type': 'tag'}
        resp = session.post(f'{dt_url}/timeline/{timeline_id}/tag', json=payload, timeout=10)
        if is_login_page(resp):
            login()
            resp = session.post(f'{dt_url}/timeline/{timeline_id}/tag', json=payload, timeout=10)
        if not resp.ok:
            raise Exception(f'{resp.status_code} {resp.text}')

    def delete_timeline(timeline_id):
        resp = session.delete(f'{dt_url}/timeline/{timeline_id}', params={'libraryId': library_id}, timeout=10)
        if is_login_page(resp):
            login()
            resp = session.delete(f'{dt_url}/timeline/{timeline_id}', params={'libraryId': library_id}, timeout=10)
        resp.raise_for_status()

    login()
    counter = 0

    while True:
        try:
            _run_watch_later_cleanup_loop(db_path, delete_timeline)
        except Exception as e:
            logger.error(f'Watch Later cleanup loop error: {e}')

        try:
            _run_submission_loop(db_path, dt_url, library_id, session, post_tag)
        except Exception as e:
            logger.error(f'Submission loop error: {e}')

        try:
            _run_tagging_loop(db_path, library_id, post_tag)
        except Exception as e:
            logger.error(f'Tagging loop error: {e}')

        if counter % 10 == 9:
            try:
                _run_polling_loop(db_path, library_id, post_timeline)
            except Exception as e:
                logger.error(f'Polling loop error: {e}')

        counter += 1
        time.sleep(30)


def _run_watch_later_cleanup_loop(db_path, delete_timeline):
    db = sqlite3.connect(db_path, timeout=10)
    db.execute('PRAGMA journal_mode=WAL')
    db.row_factory = sqlite3.Row
    try:
        videos = db.execute(
            "SELECT v.id, v.dt_timeline_id, "
            "EXISTS("
            "    SELECT 1 FROM videos v2 "
            "    LEFT JOIN playlists p2 ON p2.id = v2.playlist_id "
            "    WHERE v2.source = v.source AND p2.name != 'Watch Later'"
            ") as in_other_playlist "
            "FROM videos v "
            "LEFT JOIN playlists p ON p.id = v.playlist_id "
            "WHERE v.dt_timeline_id IS NOT NULL "
            "AND p.name = 'Watch Later'"
        ).fetchall()

        for video in videos:
            try:
                if not video['in_other_playlist']:
                    delete_timeline(video['dt_timeline_id'])
                    logger.info(f'Deleted Watch Later video {video["id"]} from DT (timeline {video["dt_timeline_id"]})')
                else:
                    logger.info(f'Watch Later video {video["id"]} skipped DT delete - URL exists in another playlist')
                db.execute(
                    'UPDATE videos SET dt_timeline_id = NULL, dt_status = NULL WHERE id = ?',
                    (video['id'],),
                )
                db.commit()
            except Exception as e:
                logger.error(f'Error removing Watch Later video {video["id"]} from DT: {e}')
    finally:
        db.close()


def _run_submission_loop(db_path, dt_url, library_id, session, post_tag):
    db = sqlite3.connect(db_path, timeout=10)
    db.execute('PRAGMA journal_mode=WAL')
    db.row_factory = sqlite3.Row
    try:
        videos = db.execute(
            "SELECT v.id, v.source, p.name as playlist_name "
            "FROM videos v "
            "LEFT JOIN playlists p ON p.id = v.playlist_id "
            "WHERE v.dt_timeline_id IS NULL "
            "AND (v.source LIKE '%youtube.com%' OR v.source LIKE '%youtu.be%') "
            "AND p.name != 'Watch Later'"
        ).fetchall()

        if not videos:
            return

        resp = session.post(
            f'{dt_url}/add-to-queue',
            json={'libraryId': library_id, 'link': [v['source'] for v in videos]},
            timeout=30,
        )
        resp.raise_for_status()
        results = resp.json()

        for video, result in zip(videos, results):
            try:
                if 'timelineId' in result:
                    timeline_id = result['timelineId']
                elif result.get('error') == 'Link already exists':
                    timeline_id = result.get('timelineId')
                    if not timeline_id:
                        logger.warning(f'Could not find existing DT item for: {video["source"]}')
                        continue
                else:
                    logger.warning(f'Unexpected response from add-to-queue: {result}')
                    continue

                db.execute(
                    'UPDATE videos SET dt_timeline_id = ? WHERE id = ?',
                    (timeline_id, video['id']),
                )
                db.commit()
                logger.info(f'Submitted video {video["id"]} -> DT item {timeline_id}')

                tagged, _ = _apply_tags(timeline_id, video['playlist_name'], post_tag)
                if tagged:
                    db.execute('UPDATE videos SET dt_tagged = 1 WHERE id = ?', (video['id'],))
                    db.commit()
            except Exception as e:
                logger.error(f'Error processing submission result for video {video["id"]}: {e}')
    finally:
        db.close()


def _apply_tags(timeline_id, playlist_name, post_tag):
    tags = ['Added by WVP'] + ([f'WVP:{playlist_name}'] if playlist_name else [])
    success = True
    errors = []
    for tag in tags:
        try:
            post_tag(timeline_id, tag)
            logger.info(f'Tagged DT item {timeline_id} with {tag}')
        except Exception as e:
            logger.error(f'Error tagging DT item {timeline_id} with {tag}: {e}')
            success = False
            errors.append(str(e))
    return success, errors


def _run_tagging_loop(db_path, library_id, post_tag):
    db = sqlite3.connect(db_path, timeout=10)
    db.execute('PRAGMA journal_mode=WAL')
    db.row_factory = sqlite3.Row
    try:
        videos = db.execute(
            "SELECT v.id, v.dt_timeline_id, v.source, v.title, p.name as playlist_name "
            "FROM videos v "
            "LEFT JOIN playlists p ON p.id = v.playlist_id "
            "WHERE v.dt_timeline_id IS NOT NULL AND v.dt_tagged IS NULL"
        ).fetchall()

        for video in videos:
            tagged, errors = _apply_tags(video['dt_timeline_id'], video['playlist_name'], post_tag)
            if tagged:
                db.execute('UPDATE videos SET dt_tagged = 1 WHERE id = ?', (video['id'],))
                db.commit()
            elif any('FOREIGN KEY' in e for e in errors):
                logger.warning(f'DT item {video["dt_timeline_id"]} no longer exists, clearing for video {video["id"]} "{video["title"]}" ({video["source"]}) to resubmit')
                db.execute('UPDATE videos SET dt_timeline_id = NULL, dt_status = NULL WHERE id = ?', (video['id'],))
                db.commit()
    finally:
        db.close()


def _run_polling_loop(db_path, library_id, post_timeline):
    db = sqlite3.connect(db_path, timeout=10)
    db.execute('PRAGMA journal_mode=WAL')
    db.row_factory = sqlite3.Row
    try:
        videos = db.execute(
            "SELECT id, dt_timeline_id FROM videos "
            "WHERE dt_timeline_id IS NOT NULL "
            "AND (dt_status IS NULL OR dt_status != 'downloaded')"
        ).fetchall()

        if not videos:
            return

        ids = [v['dt_timeline_id'] for v in videos]
        data = post_timeline({
            'libraryId': library_id,
            'search': 'id:' + ','.join(str(i) for i in ids),
            'pageSize': len(ids),
        })
        items_by_id = {item['id']: item for item in data.get('timeline', [])}

        for video in videos:
            item = items_by_id.get(video['dt_timeline_id'])
            if item:
                db.execute(
                    'UPDATE videos SET dt_status = ? WHERE id = ?',
                    (item['status'], video['id']),
                )
                logger.info(f'Polled video {video["id"]}: dt_status = {item["status"]}')
            else:
                logger.warning(f'DT item {video["dt_timeline_id"]} not found during polling')
        db.commit()
    except Exception as e:
        logger.error(f'Error during polling: {e}')
    finally:
        db.close()

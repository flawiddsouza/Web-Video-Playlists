"""
Validates that all dt_timeline_id values in WVP DB have a matching entry in DT.
Reports orphaned entries and optionally clears them.
"""
import sqlite3
import os
from dotenv import load_dotenv
import requests

load_dotenv()

DB_PATH = os.path.join(os.path.dirname(__file__), 'store.db')
DT_URL = os.environ['DT_URL'].rstrip('/')
LIBRARY_ID = os.environ.get('DT_LIBRARY_ID', 'main')
USERNAME = os.environ.get('DT_USERNAME', '')
PASSWORD = os.environ.get('DT_PASSWORD', '')

session = requests.Session()


def login():
    resp = session.post(
        f'{DT_URL}/',
        data={
            'username': USERNAME,
            'password': PASSWORD,
            'redirectBackTo': f'{DT_URL}/?library={LIBRARY_ID}',
        },
        timeout=10,
        allow_redirects=True,
    )
    print(f'Login: {resp.status_code} {resp.headers.get("content-type")}')


def is_login_page(resp):
    return 'text/html' in resp.headers.get('content-type', '')


def fetch_all_dt_ids():
    """Return set of all timeline IDs in DT."""
    ids = set()
    page = 1
    page_size = 200
    while True:
        resp = session.post(
            f'{DT_URL}/timeline',
            json={'libraryId': LIBRARY_ID, 'page': page, 'pageSize': page_size},
            timeout=15,
        )
        if is_login_page(resp):
            login()
            resp = session.post(
                f'{DT_URL}/timeline',
                json={'libraryId': LIBRARY_ID, 'page': page, 'pageSize': page_size},
                timeout=15,
            )
        resp.raise_for_status()
        data = resp.json()
        items = data.get('timeline', [])
        for item in items:
            ids.add(item['id'])
        print(f'  Page {page}/{data.get("totalPages", "?")} — {len(ids)} DT items so far')
        if page >= data.get('totalPages', 1):
            break
        page += 1
    return ids


def get_wvp_dt_videos():
    """Return all WVP videos that have dt_timeline_id set."""
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    try:
        return db.execute(
            'SELECT v.id, v.title, v.source, v.dt_timeline_id, v.dt_status, v.dt_tagged, p.name as playlist '
            'FROM videos v '
            'LEFT JOIN playlists p ON p.id = v.playlist_id '
            'WHERE v.dt_timeline_id IS NOT NULL'
        ).fetchall()
    finally:
        db.close()


def clear_orphaned(video_ids):
    db = sqlite3.connect(DB_PATH)
    try:
        db.executemany(
            'UPDATE videos SET dt_timeline_id = NULL, dt_status = NULL, dt_tagged = NULL WHERE id = ?',
            [(vid,) for vid in video_ids],
        )
        db.commit()
        print(f'Cleared {len(video_ids)} orphaned entries.')
    finally:
        db.close()


def main():
    print('Logging in...')
    login()

    print('Fetching all DT timeline IDs...')
    dt_ids = fetch_all_dt_ids()
    print(f'  {len(dt_ids)} total items in DT')

    print('Loading WVP videos with dt_timeline_id...')
    wvp_videos = get_wvp_dt_videos()
    print(f'  {len(wvp_videos)} WVP videos have dt_timeline_id set')

    orphaned = [v for v in wvp_videos if v['dt_timeline_id'] not in dt_ids]
    valid = [v for v in wvp_videos if v['dt_timeline_id'] in dt_ids]

    print(f'\n{len(valid)} valid, {len(orphaned)} orphaned')

    if orphaned:
        print('\nOrphaned entries (dt_timeline_id exists in WVP but not in DT):')
        for v in orphaned:
            print(f'  [wvp:{v["id"]}] dt:{v["dt_timeline_id"]} | {v["playlist"]} | {v["title"]}')

        answer = input('\nClear orphaned dt_timeline_id / dt_status / dt_tagged from WVP DB? [y/N] ').strip().lower()
        if answer == 'y':
            clear_orphaned([v['id'] for v in orphaned])
    else:
        print('All DT IDs are valid.')


if __name__ == '__main__':
    main()

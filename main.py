from flask import Flask, render_template, jsonify, g, request
import os
import sqlite3
from operator import itemgetter

app = Flask(__name__)

app.database = 'store.db'
app.database = os.path.join(os.path.dirname(__file__), app.database)
app.debug = False

videos_table_columns = ['title', 'description', 'thumbnail', 'duration', 'uploader', 'uploader_url', 'published_at', 'source', 'note', 'tags', 'playlist_id']
playlists_table_columns = ['name', 'description']

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/videos')
def get_videos():
    return get_all('SELECT * FROM videos ORDER BY updated_at DESC')

@app.route('/videos/<playlist_id>')
def get_videos_for_playlist(playlist_id):
    return get_all('SELECT * FROM videos WHERE playlist_id=? ORDER BY updated_at DESC', [playlist_id])

@app.route('/add-video', methods=['POST'])
def add_video():
    success = insert(request, 'videos', videos_table_columns)
    if success:
        return jsonify(status='success', message='Video Added')
    else:
        return jsonify(status='error', message="Video Couldn't be Added")

@app.route('/edit-video', methods=['POST'])
def edit_video():
    success = update(request, 'videos', videos_table_columns)
    if success:
        return jsonify(status='success', message='Video Updated')
    else:
        return jsonify(status='error', message="Video Couldn't be Updated")

@app.route('/delete-video', methods=['POST'])
def delete_video():
    success = delete(request, 'videos')
    if success:
        return jsonify(status='success', message='Video Deleted')
    else:
        return jsonify(status='error', message="Video Couldn't be Deleted")

@app.route('/playlists')
def get_playlists():
    g.db = connect_db()
    g.db.row_factory = make_dicts
    videos = g.db.execute('SELECT * FROM videos')
    videos = videos.fetchall()
    playlists = g.db.execute('SELECT * FROM playlists')
    playlists = playlists.fetchall()
    g.db.close()

    videos_playlists = dict()
    for video in videos:
        if video['playlist_id'] in videos_playlists:
            videos_playlists[video['playlist_id']].append(video)
        else:
            videos_playlists[video['playlist_id']] = list()
            videos_playlists[video['playlist_id']].append(video)

    playlist_ids_by_latest_video = list()

    for videos_playlist in videos_playlists:
        max_dict_in_list = max(videos_playlists[videos_playlist], key=itemgetter('updated_at'))
        custom_dict = dict()
        custom_dict['id'] = max_dict_in_list['playlist_id']
        custom_dict['updated_at:1'] = max_dict_in_list['updated_at']
        playlist_ids_by_latest_video.append(custom_dict)

    playlists_by_latest_video = list()
    for playlist_id_by_latest_video in playlist_ids_by_latest_video:
        for playlist in playlists:
            if playlist['id'] == playlist_id_by_latest_video['id']:
                playlists_by_latest_video.append({**playlist_id_by_latest_video, **playlist})

    playlists_by_latest_video_sorted_desc = sorted(playlists_by_latest_video, key=itemgetter('updated_at:1'), reverse=True)

    # missing_playlists aka playlists with no videos added to them yet, so there's no latest video, hence the missing tag
    missing_playlists = list()
    for playlist in playlists:
        this_playlist_found = False
        for playlist_by_latest_video_sorted_desc in playlists_by_latest_video_sorted_desc:
            if playlist['id'] == playlist_by_latest_video_sorted_desc['id']:
                this_playlist_found = True
                break
        if this_playlist_found is False:
            missing_playlists.append(playlist)

    final_playlists = playlists_by_latest_video_sorted_desc + missing_playlists

    # if len(playlists) == len(final_playlists):
    #     print("total playlists are equal - yay! :)")
    # else:
    #     print("total playlists are unequal - nay :(")

    return jsonify(final_playlists)

@app.route('/playlist/<id>')
def get_playlist(id):
    return get_one('SELECT name FROM playlists WHERE id =?', [id])

@app.route('/add-playlist', methods=['POST'])
def add_playlist():
    success = insert(request, 'playlists', playlists_table_columns)
    if success:
        return jsonify(status='success', message='Playlist Added')
    else:
        return jsonify(status='error', message="Playlist Couldn't be Added")

@app.route('/edit-playlist', methods=['POST'])
def edit_playlist():
    success = update(request, 'playlists', playlists_table_columns)
    if success:
        return jsonify(status='success', message='Playlist Updated')
    else:
        return jsonify(status='error', message="Playlist Couldn't be Updated")

@app.route('/delete-playlist', methods=['POST'])
def delete_playlist():
    success = delete(request, 'playlists')
    if success:
        return jsonify(status='success', message='Playlist Deleted')
    else:
        return jsonify(status='error', message="Playlist Couldn't be Deleted")

@app.route('/url-exists-in-playlist')
def url_exists_in_playlist():
    g.db = connect_db()
    g.db.row_factory = make_dicts
    videos = g.db.execute('SELECT playlist_id FROM videos WHERE source LIKE ?', [request.args.get('url') + '%']).fetchall()
    found_in_playlists = []
    for video in videos:
        found_in_playlists.append(g.db.execute('SELECT name FROM playlists WHERE id = ?', [video['playlist_id']]).fetchone()['name'])
    g.db.close()
    return jsonify(found_in_playlists)

def connect_db():
    return sqlite3.connect(app.database, timeout=10)

def insert(request, table_name, table_columns):
    table_columns_dict = {}
    if request.get_json() == None:
        for table_column in table_columns:
            if request.form.get(table_column) != None:
                table_columns_dict[table_column] = request.form.get(table_column)
    else:
        for table_column in table_columns:
            if table_column in request.get_json():
                table_columns_dict[table_column] = request.get_json()[table_column]
    fields = ",".join(table_columns_dict.keys())
    question_marks = ','.join(list('?'*len(table_columns_dict)))
    values = list(table_columns_dict.values())
    try:
        g.db = connect_db()
        g.db.execute(f'INSERT into {table_name}({fields}) VALUES({question_marks})', values)
        g.db.commit()
        g.db.close()
    except Exception as e:
        print(e)
        return False
    return True

def update(request, table_name, table_columns):
    table_columns_dict = {}
    if request.get_json() == None:
        for table_column in table_columns:
            if request.form.get(table_column) != None:
                table_columns_dict[table_column] = request.form.get(table_column)
        if request.form.get('id') != None:
            id = request.form.get('id')
        else:
            return False # if id is empty
    else:
        for table_column in table_columns:
            if table_column in request.get_json():
                table_columns_dict[table_column] = request.get_json()[table_column]
        if 'id' in request.get_json():
            id = request.get_json()['id']
        else:
            return False
    fields = "=?,".join(table_columns_dict.keys()) + "=?"
    values = list(table_columns_dict.values())
    values.append(id)
    try:
        g.db = connect_db()
        g.db.execute(f'UPDATE {table_name} SET {fields}, updated_at=CURRENT_TIMESTAMP WHERE id=?', values)
        g.db.commit()
        g.db.close()
    except Exception as e:
        print(e)
        return False
    return True

def delete(request, table_name):
    if request.get_json() == None:
        if request.form.get('id') != None:
            id = request.form.get('id')
        else:
            return False
    else:
        if 'id' in request.get_json():
            id = request.get_json()['id']
        else:
            return False
    try:
        g.db = connect_db()
        g.db.execute(f'DELETE FROM {table_name} WHERE id=?', [id])
        g.db.commit()
        g.db.close()
    except Exception as e:
        print(e)
        return False
    return True

def get_one(query, query_params):
    g.db = connect_db()
    g.db.row_factory = make_dicts
    row = g.db.execute(query, query_params)
    row = row.fetchone()
    g.db.close()
    return jsonify(row)

def get_all(query, query_params=None):
    g.db = connect_db()
    g.db.row_factory = make_dicts
    if query_params is not None:
        rows = g.db.execute(query, query_params)
    else:
        rows = g.db.execute(query)
    rows = rows.fetchall()
    g.db.close()
    return jsonify(rows)

def make_dicts(cursor, row):
    return dict((cursor.description[idx][0], value)
                for idx, value in enumerate(row))

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=9881, threaded=True)
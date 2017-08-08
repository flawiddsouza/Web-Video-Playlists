import sqlite3, os.path

if not os.path.isfile('store.db'):
    with sqlite3.connect('store.db') as connection:
        c = connection.cursor()
        c.execute('''
            CREATE TABLE videos(
                id INTEGER,
                title TEXT,
                description TEXT,
                thumbnail TEXT,
                thumbnail_local TEXT,
                duration TEXT,
                uploader TEXT,
                uploader_url TEXT,
                published_at TEXT,
                source TEXT,
                note TEXT,
                tags TEXT,
                playlist_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY(id),
                FOREIGN KEY(playlist_id) REFERENCES playlists(id) ON UPDATE CASCADE ON DELETE CASCADE
            )
        ''')
        c.execute('''
            CREATE TABLE playlists(
                id INTEGER,
                name TEXT NOT NULL UNIQUE,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY(id)
            )
        ''')
        c.execute('''
            CREATE VIEW playlists_ordered_by_latest_video AS
            SELECT playlists.*, playlists_videos_latest_updated.updated_at FROM
            (
                SELECT playlist_id, updated_at
                FROM videos
                WHERE videos.updated_at = (SELECT MAX(updated_at) FROM videos latest WHERE playlist_id = videos.playlist_id)
            ) playlists_videos_latest_updated
            LEFT OUTER JOIN  playlists ON playlists_videos_latest_updated.playlist_id = playlists.id
            UNION
            SELECT playlists.*, playlists_videos_latest_updated.updated_at  FROM playlists
            LEFT OUTER JOIN
            (
                SELECT playlist_id, updated_at
                FROM videos
                WHERE videos.updated_at = (SELECT MAX(updated_at) FROM videos latest WHERE playlist_id = videos.playlist_id)
            ) playlists_videos_latest_updated
            ON playlists.id = playlists_videos_latest_updated.playlist_id
            ORDER BY playlists_videos_latest_updated.updated_at DESC
        ''')
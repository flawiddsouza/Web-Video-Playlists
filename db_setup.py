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
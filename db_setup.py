import sqlite3
import os.path

def setup(db_path='store.db'):
    with sqlite3.connect(db_path) as connection:
        c = connection.cursor()
        c.execute('''
            CREATE TABLE IF NOT EXISTS playlists(
                id INTEGER,
                name TEXT NOT NULL UNIQUE,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY(id)
            )
        ''')
        c.execute('''
            CREATE TABLE IF NOT EXISTS videos(
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
                dt_timeline_id INTEGER,
                dt_status TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY(id),
                FOREIGN KEY(playlist_id) REFERENCES playlists(id) ON UPDATE CASCADE ON DELETE CASCADE
            )
        ''')
        for column, col_type in [('dt_timeline_id', 'INTEGER'), ('dt_status', 'TEXT'), ('dt_tagged', 'INTEGER')]:
            try:
                c.execute(f'ALTER TABLE videos ADD COLUMN {column} {col_type}')
            except sqlite3.OperationalError as e:
                if 'duplicate column name' not in str(e):
                    raise

if __name__ == '__main__':
    setup()

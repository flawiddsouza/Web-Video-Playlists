import os
import sqlite3
import re
import requests
from tqdm import tqdm
import uuid

os.chdir("..")

with sqlite3.connect('store.db') as connection:
    c = connection.cursor()
    c.row_factory = sqlite3.Row
    videos = c.execute('SELECT * FROM videos')
    videos = videos.fetchall()
    count = 0
    for video in videos:
        if not video['thumbnail_local']:
            print(video['title'])
            response = requests.get(video['thumbnail'], stream=True)
            total_size = int(response.headers.get('content-length', 0)) 
            filename = str(uuid.uuid4()) + '_' + video['thumbnail'].rsplit('/', 1)[-1]
            filename = re.sub(r"\?.*", '', filename)
            with open('static/thumbnails/' + filename, 'wb') as handle:
                for data in tqdm(response.iter_content(), total=total_size):
                    handle.write(data)
            c.execute(f'UPDATE videos SET thumbnail_local=? WHERE id=?', [filename, video['id']])
            count = count + 1
    print(str(count) + ' thumbnails have been localized')
    connection.commit()
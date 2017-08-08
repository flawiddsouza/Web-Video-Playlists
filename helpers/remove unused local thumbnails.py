import os
import sqlite3

os.chdir("..")

thumbnails_dir = 'static/thumbnails/'

local_thumbnails_in_use = set()
local_thumbnails_in_folder = set()

with sqlite3.connect('store.db') as connection:
    c = connection.cursor()
    c.row_factory = sqlite3.Row
    videos = c.execute('SELECT * FROM videos')
    videos = videos.fetchall()

    for video in videos:
        if video['thumbnail_local']:
            local_thumbnails_in_use.add(video['thumbnail_local'])

for (dirpath, dirnames, filenames) in os.walk(thumbnails_dir):
    local_thumbnails_in_folder = set(filenames)
    break

local_thumbnails_not_in_use = local_thumbnails_in_folder.symmetric_difference(local_thumbnails_in_use)

for local_thumbnail_not_in_use in local_thumbnails_not_in_use:
    filepath = os.path.join(thumbnails_dir, local_thumbnail_not_in_use)
    if os.path.isfile(filepath):
        os.remove(filepath)

print(str(len(local_thumbnails_not_in_use)) + ' unused items have been removed from the thumbnails directory')
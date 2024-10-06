### Virtual Environment Setup (PowerShell)

```sh
# Create virtual env
python -m venv venv

# Activate virtual env
venv\Scripts\Activate.ps1
```

### Package Installation

```sh
pip install -r requirements.txt
```

### Run

```sh
python main.py
```

### Running in pm2

```sh
pm2 start --name "Web Video Playlists" --interpreter=venv\Scripts\pythonw.exe main.py
```

Or through pm2.yml

```yaml
- name: Web Video Playlists
  script: main.py
  cwd: ./Web Video Playlists
  exec_interpreter: ./venv/Scripts/pythonw.exe
```

```sh
pm2 start pm2.yml
```

### Docker (PowerShell)

Build Image

```sh
docker build -t web-video-playlists .
```

Run

```sh
docker run -p 9881:9881 --name "web-video-playlists" --rm -v ${PWD}\store.db:/app/store.db web-video-playlists
```

Run as daemon

```sh
docker run -p 9881:9881 --name "web-video-playlists" -d -v ${PWD}\store.db:/app/store.db web-video-playlists
```

Update daemon

```sh
docker stop web-video-playlists && docker rm web-video-playlists
docker run -p 9881:9881 --name "web-video-playlists" -d -v ${PWD}\store.db:/app/store.db web-video-playlists
```

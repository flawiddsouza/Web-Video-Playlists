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

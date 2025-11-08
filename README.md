# 前端
步驟 1：進入前端資料夾
cd frontend

步驟 2：安裝所有必要的套件
npm install

步驟 3：設定環境變數
在 frontend 資料夾中，手動建立一個名為 .env 的檔案（如果需要）。

步驟 4：啟動開發伺服器
npm start


# 後端

步驟 1：進入後端資料夾
cd backend

步驟 2：建立 Python 虛擬環境(要有python套件 沒有要載)
python -m venv .venv

步驟 3：啟動虛擬環境
.\.venv\Scripts\Activate.ps1

步驟 4：安裝所有必要的套件
pip install -r requirements/development.txt

步驟 5：設定環境變數
在 backend 資料夾中，手動建立一個名為 .env 的檔案。
在 backend 資料夾手動建立serviceAccountKey.json檔案然後複製那一長串(在DC)

步驟 6：執行資料庫遷移 (Database Migrations)
python manage.py migrate

步驟 7：啟動開發伺服器(要下載VS CODE的powershell)
一切準備就緒！執行start_dev_servers.ps1

# !!!額外套件!!!(必要，)

cd frontend; npm install axios
cd frontend; npm install react-icons

**後端的指令記得要在虛擬環境有啟動的情況下再打(步驟3的指令)**
cd backend; python -m pip install Pillow
cd backend; pip.exe install firebase-admin
cd backend; pip.exe install djangorestframework-simplejwt





# 重整資料庫

cd backend; .\.venv\Scripts\python.exe manage.py makemigrations users(有動過資料庫結構要打這串，沒有就不用)

cd backend; .\.venv\Scripts\python.exe manage.py migrate(每次抓新檔案先執行一次)


# 前端卸載指令(非必要，除非你專案炸了要重拉)
Remove-Item -Recurse -Force node_modules
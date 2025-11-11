
$scriptPath = $PSScriptRoot

$backendPath = Join-Path -Path $scriptPath -ChildPath "backend"

$backendTitle = "後端伺服器 (Django)"

$backendCommand = "cd '$backendPath'; Write-Host '正在啟動 Django 後端伺服器...'; .\.venv\Scripts\python.exe manage.py runserver"

Start-Process powershell -ArgumentList "-NoExit", "-Command", "($Host.UI.RawUI.WindowTitle = '$backendTitle'); $backendCommand"


$frontendPath = Join-Path -Path $scriptPath -ChildPath "frontend"# 在專案根目錄（c:\Users\88693\Downloads\project3-Beta）執行：
tree /F /A > filelist.txt
notepad filelist.txt

$frontendTitle = "前端伺服器 (React)"

$frontendCommand = "cd '$frontendPath'; Write-Host '正在啟動 React 前端伺服器...'; npm start"

Start-Process powershell -ArgumentList "-NoExit", "-Command", "($Host.UI.RawUI.WindowTitle = '$frontendTitle'); $frontendCommand"

Write-Host "ACTIVE"

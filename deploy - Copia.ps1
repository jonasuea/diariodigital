# deploy.ps1
# Este script automatiza o versionamento Git, o build da aplicação e o deploy no Firebase.

param(
    [Parameter(Mandatory=$true, HelpMessage="Insira a mensagem do commit")]
    [Alias("m")]
    [string]$CommitMessage
)

# --- FUNÇÕES DE SUPORTE ---

function Invoke-GitCommand {
    param ($command)
    Write-Host "Executando: git $command" -ForegroundColor Gray
    Invoke-Expression "git $command"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERRO: Falha ao executar 'git $command'. Abortando." -ForegroundColor Red
        exit 1
    }
}

function Check-LastCommand {
    param ($ErrorMessage)
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERRO: $ErrorMessage. Abortando." -ForegroundColor Red
        exit 1
    }
}

# --- INÍCIO DO PROCESSO ---

Write-Host "--- Iniciando o processo de deploy ---" -ForegroundColor Cyan

# 1. Verificar se há alterações para commitar
if (-not (git status --porcelain)) {
    Write-Host "Nenhuma alteração detectada. O diretório está limpo." -ForegroundColor Yellow
    exit 0
}

# 2. Lógica de Versionamento (Tags)
$latestTag = git describe --tags --abbrev=0 2>$null

if ([string]::IsNullOrWhiteSpace($latestTag)) {
    Write-Host "Nenhuma tag encontrada. Definindo versão inicial: v0.1.0" -ForegroundColor Yellow
    $newVersion = "v0.1.0"
} else {
    try {
        $versionParts = $latestTag.TrimStart('v').Split('.')
        $major = [int]$versionParts[0]
        $minor = [int]$versionParts[1]
        $patch = [int]$versionParts[2]
        $patch++
        $newVersion = "v$($major).$($minor).$($patch)"
        Write-Host "Última versão: $latestTag -> Nova versão calculada: $newVersion" -ForegroundColor Green
    } catch {
        $newVersion = "v0.1.0"
        Write-Host "Erro ao processar tag. Resetando para v0.1.0" -ForegroundColor Yellow
    }
}

# 3. Fluxo Git (Commit e Tags)
Write-Host "Preparando arquivos e criando commit..." -ForegroundColor Cyan
Invoke-GitCommand "add ."
Invoke-GitCommand "commit -m `"$CommitMessage`""
Invoke-GitCommand "tag $newVersion -m `"Release $newVersion: $CommitMessage`""

Write-Host "Enviando para o repositório remoto (main)..." -ForegroundColor Cyan
# Nota: Ajuste para 'master' se seu branch principal ainda usar o nome antigo
Invoke-GitCommand "push origin main"
Invoke-GitCommand "push origin --tags"

# --- PASSO 4: BUILD E FIREBASE ---

Write-Host "`n--- Iniciando Build de Produção ---" -ForegroundColor Cyan
npm run build
Check-LastCommand "Erro durante o build (npm run build)"

Write-Host "Iniciando o deploy para o Firebase Hosting..." -ForegroundColor Cyan
firebase deploy
Check-LastCommand "Erro ao publicar no Firebase"

Write-Host "`n------------------------------------------------------------" -ForegroundColor Green
Write-Host "✅ Sucesso! Versão $newVersion publicada no GitHub e Firebase." -ForegroundColor Green
Write-Host "------------------------------------------------------------" -ForegroundColor Green
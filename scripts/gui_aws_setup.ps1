Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$form = New-Object System.Windows.Forms.Form
$form.Text = "BioCloud Workbench - AWS Deployment Setup"
$form.Size = New-Object System.Drawing.Size(480, 300)
$form.StartPosition = "CenterScreen"
$form.TopMost = $true

$title = New-Object System.Windows.Forms.Label
$title.Location = New-Object System.Drawing.Point(20, 15)
$title.Size = New-Object System.Drawing.Size(420, 30)
$title.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$title.Text = "Enter AWS Credentials to Deploy Stack (eu-north-1)"
$form.Controls.Add($title)

$label1 = New-Object System.Windows.Forms.Label
$label1.Location = New-Object System.Drawing.Point(20, 55)
$label1.Size = New-Object System.Drawing.Size(420, 20)
$label1.Text = "AWS Access Key ID (e.g. AKIA...):"
$form.Controls.Add($label1)

$txtKey = New-Object System.Windows.Forms.TextBox
$txtKey.Location = New-Object System.Drawing.Point(20, 75)
$txtKey.Size = New-Object System.Drawing.Size(420, 25)
$form.Controls.Add($txtKey)

$label2 = New-Object System.Windows.Forms.Label
$label2.Location = New-Object System.Drawing.Point(20, 115)
$label2.Size = New-Object System.Drawing.Size(420, 20)
$label2.Text = "AWS Secret Access Key (input hidden):"
$form.Controls.Add($label2)

$txtSec = New-Object System.Windows.Forms.TextBox
$txtSec.Location = New-Object System.Drawing.Point(20, 135)
$txtSec.Size = New-Object System.Drawing.Size(420, 25)
$txtSec.PasswordChar = '*'
$form.Controls.Add($txtSec)

$btnSubmit = New-Object System.Windows.Forms.Button
$btnSubmit.Location = New-Object System.Drawing.Point(150, 190)
$btnSubmit.Size = New-Object System.Drawing.Size(170, 40)
$btnSubmit.Text = "Save & Deploy to AWS"
$btnSubmit.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$btnSubmit.DialogResult = [System.Windows.Forms.DialogResult]::OK
$form.Controls.Add($btnSubmit)
$form.AcceptButton = $btnSubmit

$result = $form.ShowDialog()
if ($result -eq [System.Windows.Forms.DialogResult]::OK -and $txtKey.Text.Trim() -and $txtSec.Text.Trim()) {
    $awsDir = Join-Path $HOME ".aws"
    if (-not (Test-Path $awsDir)) {
        New-Item -ItemType Directory -Path $awsDir -Force | Out-Null
    }
    $credPath = Join-Path $awsDir "credentials"
    $configPath = Join-Path $awsDir "config"
    
    "[default]`naws_access_key_id = $($txtKey.Text.Trim())`naws_secret_access_key = $($txtSec.Text.Trim())" | Set-Content $credPath -Encoding UTF8
    "[default]`nregion = eu-north-1`noutput = json" | Set-Content $configPath -Encoding UTF8
    
    Write-Output "CREDENTIALS_SAVED_SUCCESSFULLY"
} else {
    Write-Output "DIALOG_CANCELLED"
}

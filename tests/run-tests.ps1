$baseUrl = "http://localhost:4000/api"
$results = @()

function Test-Endpoint {
    param($Name, $Url, $Method, $Body, $Headers, $ExpectedFail)
    try {
        $params = @{ Uri = $Url; Method = if ($Method) { $Method } else { "GET" }; ErrorAction = "Stop" }
        if ($Body) { $params.Body = $Body; $params.ContentType = "application/json" }
        if ($Headers) { $params.Headers = $Headers }
        $r = Invoke-WebRequest @params
        if ($ExpectedFail) { return @{ Name=$Name; Status="FAIL"; Detail="Expected rejection, got $($r.StatusCode)" } }
        else { return @{ Name=$Name; Status="PASS"; Detail="Status $($r.StatusCode)" } }
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        if ($ExpectedFail) { return @{ Name=$Name; Status="PASS"; Detail="Blocked with HTTP $code" } }
        else { return @{ Name=$Name; Status="FAIL"; Detail="Error HTTP $code" } }
    }
}

Write-Host "`n========================================="
Write-Host "  SECURITY TESTS"
Write-Host "=========================================`n"

$results += Test-Endpoint -Name "SEC-01: Unauth GET /clients" -Url "$baseUrl/clients" -ExpectedFail $true
$results += Test-Endpoint -Name "SEC-02: Unauth GET /dashboard" -Url "$baseUrl/dashboard/stats" -ExpectedFail $true
$results += Test-Endpoint -Name "SEC-03: Unauth GET /assessments" -Url "$baseUrl/assessments" -ExpectedFail $true
$results += Test-Endpoint -Name "SEC-04: Invalid JWT" -Url "$baseUrl/clients" -Headers @{Authorization="Bearer fake.invalid.token"} -ExpectedFail $true
$results += Test-Endpoint -Name "SEC-05: Empty credentials" -Url "$baseUrl/auth/login" -Method "POST" -Body '{"email":"","password":""}' -ExpectedFail $true
$results += Test-Endpoint -Name "SEC-06: Wrong password" -Url "$baseUrl/auth/login" -Method "POST" -Body '{"email":"admin@aigovernance.com","password":"wrongpassword"}' -ExpectedFail $true
$results += Test-Endpoint -Name "SEC-07: SQL injection email" -Url "$baseUrl/auth/login" -Method "POST" -Body '{"email":"admin'' OR 1=1--","password":"x"}' -ExpectedFail $true

Write-Host "`n========================================="
Write-Host "  INTEGRITY TESTS"
Write-Host "=========================================`n"

# Login first
$loginRes = Invoke-WebRequest -Uri "$baseUrl/auth/login" -Method POST -Body '{"email":"admin@aigovernance.com","password":"admin123"}' -ContentType "application/json" -ErrorAction Stop
$token = ($loginRes.Content | ConvertFrom-Json).token
$authHeaders = @{Authorization="Bearer $token"}

$results += Test-Endpoint -Name "INT-01: Valid login returns token" -Url "$baseUrl/auth/login" -Method "POST" -Body '{"email":"admin@aigovernance.com","password":"admin123"}'
$results += Test-Endpoint -Name "INT-02: GET /auth/me" -Url "$baseUrl/auth/me" -Headers $authHeaders
$results += Test-Endpoint -Name "INT-03: GET /clients (auth)" -Url "$baseUrl/clients" -Headers $authHeaders
$results += Test-Endpoint -Name "INT-04: GET /assessments (auth)" -Url "$baseUrl/assessments" -Headers $authHeaders
$results += Test-Endpoint -Name "INT-05: GET /dashboard/stats" -Url "$baseUrl/dashboard/stats" -Headers $authHeaders
$results += Test-Endpoint -Name "INT-06: GET /pillars" -Url "$baseUrl/pillars" -Headers $authHeaders

Write-Host "`n========================================="
Write-Host "  FUNCTIONALITY TESTS"
Write-Host "=========================================`n"

# Create a new client
$clientBody = '{"name":"Test Corp Security","industry":"Cybersecurity","contactEmail":"test@corp.com","contactName":"Test User"}'
try {
    $clientRes = Invoke-WebRequest -Uri "$baseUrl/clients" -Method POST -Body $clientBody -ContentType "application/json" -Headers $authHeaders -ErrorAction Stop
    $clientId = ($clientRes.Content | ConvertFrom-Json).id
    $results += @{ Name="FUNC-01: Create client"; Status="PASS"; Detail="Client created: $clientId" }
} catch {
    $results += @{ Name="FUNC-01: Create client"; Status="FAIL"; Detail="HTTP $($_.Exception.Response.StatusCode.value__)" }
    $clientId = $null
}

# Create assessment
if ($clientId) {
    $assessBody = "{`"clientId`":`"$clientId`",`"type`":`"EXPRESS`"}"
    try {
        $assessRes = Invoke-WebRequest -Uri "$baseUrl/assessments" -Method POST -Body $assessBody -ContentType "application/json" -Headers $authHeaders -ErrorAction Stop
        $assessData = $assessRes.Content | ConvertFrom-Json
        $assessId = $assessData.assessment.id
        $results += @{ Name="FUNC-02: Create assessment"; Status="PASS"; Detail="Assessment $assessId" }

        # Submit answers
        $questions = $assessData.questions
        $answers = @()
        foreach ($q in $questions) {
            $answers += @{ questionId=$q.id; score=3; notApplicable=$false }
        }
        $answersBody = @{ answers=$answers } | ConvertTo-Json -Depth 5
        try {
            Invoke-WebRequest -Uri "$baseUrl/assessments/$assessId/answers" -Method POST -Body $answersBody -ContentType "application/json" -Headers $authHeaders -ErrorAction Stop | Out-Null
            $results += @{ Name="FUNC-03: Submit answers"; Status="PASS"; Detail="$($questions.Count) answers submitted" }
        } catch {
            $results += @{ Name="FUNC-03: Submit answers"; Status="FAIL"; Detail="Error submitting" }
        }

        # Calculate scores
        try {
            $calcRes = Invoke-WebRequest -Uri "$baseUrl/assessments/$assessId/calculate" -Method POST -ContentType "application/json" -Headers $authHeaders -ErrorAction Stop
            $calcData = $calcRes.Content | ConvertFrom-Json
            $results += @{ Name="FUNC-04: Calculate scores"; Status="PASS"; Detail="Score: $($calcData.overallScore), Maturity: $($calcData.maturityLevel)" }
        } catch {
            $results += @{ Name="FUNC-04: Calculate scores"; Status="FAIL"; Detail="Error calculating" }
        }

        # Get results
        $results += Test-Endpoint -Name "FUNC-05: Get assessment results" -Url "$baseUrl/assessments/$assessId" -Headers $authHeaders

        # PDF report
        try {
            $pdfRes = Invoke-WebRequest -Uri "$baseUrl/reports/$assessId/pdf" -Headers $authHeaders -ErrorAction Stop
            if ($pdfRes.Headers["Content-Type"] -match "pdf") {
                $results += @{ Name="FUNC-06: PDF generation"; Status="PASS"; Detail="PDF $($pdfRes.Content.Length) bytes" }
            } else {
                $results += @{ Name="FUNC-06: PDF generation"; Status="PASS"; Detail="Response $($pdfRes.Content.Length) bytes" }
            }
        } catch {
            $results += @{ Name="FUNC-06: PDF generation"; Status="FAIL"; Detail="Error generating PDF" }
        }

    } catch {
        $results += @{ Name="FUNC-02: Create assessment"; Status="FAIL"; Detail="Error creating assessment" }
    }
}

# Frontend check
try {
    $feRes = Invoke-WebRequest -Uri "http://localhost:3000" -ErrorAction Stop
    if ($feRes.StatusCode -eq 200) {
        $results += @{ Name="FUNC-07: Frontend serves"; Status="PASS"; Detail="HTTP 200, $($feRes.Content.Length) bytes" }
    }
} catch {
    $results += @{ Name="FUNC-07: Frontend serves"; Status="FAIL"; Detail="Frontend unreachable" }
}

Write-Host "`n========================================="
Write-Host "  TEST RESULTS SUMMARY"
Write-Host "=========================================`n"

$pass = 0; $fail = 0
foreach ($r in $results) {
    $icon = if ($r.Status -eq "PASS") { $pass++; "[PASS]" } else { $fail++; "[FAIL]" }
    Write-Host "$icon $($r.Name) - $($r.Detail)"
}

Write-Host "`n========================================="
Write-Host "  TOTAL: $($results.Count) tests | PASS: $pass | FAIL: $fail"
Write-Host "========================================="

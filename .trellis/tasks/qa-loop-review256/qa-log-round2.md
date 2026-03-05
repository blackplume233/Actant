## QA Loop Round 2 Log
Scenario: review-256 daemon/rest-api regression
Time: 2026-02-28T23:51:29.8299182+08:00
ACTANT_HOME: C:\Users\black\AppData\Local\Temp\actant-qa-ad89fcb1

### [S1] Start daemon job
Time: 2026-02-28T23:51:34.0096938+08:00
Input: 
exit_code: 0
Output:
job_id=1 state=Running
Judgment: PASS
Reason: Daemon should stay running in foreground job.

### [S2] Daemon status check
Time: 2026-02-28T23:51:34.4171193+08:00
Input: 
exit_code: 0
Output:
Daemon is running.
  Version: 0.2.3
  Uptime:  3s
  Agents:  0

Judgment: PASS
Reason: Expect exit 0 and running output.

### [S3] Start API job
Time: 2026-02-28T23:51:38.5087231+08:00
Input: 
exit_code: 0
Output:
job_id=3 state=Running
Judgment: PASS
Reason: API server should stay running.

### [S4] SSE without token returns 401
Time: 2026-02-28T23:51:39.1010911+08:00
Input: 
exit_code: 0
Output:
status_code=-1
Judgment: FAIL
Reason: Expected unauthorized response for unauthenticated SSE.

### [S5] SSE with token accepted
Time: 2026-02-28T23:51:41.1496663+08:00
Input: 
exit_code: 28
Output:
curl.exe :   % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
At line:49 char:14
+ ...  $curlOut = & curl.exe -i --max-time 2 "http://127.0.0.1:$apiPort/v1/ ...
+                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (  % Total    % ...  Time  Current:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
                                 Dload  Upload   Total   Spent    Left  Speed

  0     0    0     0    0     0      0      0 --:--:-- --:--:-- --:--:--     0
100   256    0   256    0     0   1256      0 --:--:-- --:--:-- --:--:--  1254
100   256    0   256    0     0    211      0 --:--:--  0:00:01 --:--:--   211
100   256    0   256    0     0    127      0 --:--:--  0:00:02 --:--:--   127
curl: (28) Operation timed out after 2007 milliseconds with 256 bytes received
HTTP/1.1 200 OK
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key
Access-Control-Max-Age: 86400
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
Date: Sat, 28 Feb 2026 15:51:39 GMT
Transfer-Encoding: chunked

event: status
data: {"version":"0.2.3","uptime":7,"agents":0}

event: agents
data: []

event: events
data: {"events":[{"ts":1772293891197,"event":"actant:start","caller":"system:Daemon","payload":{"version":"0.1.0"}}]}

event: canvas
data: {"entries":[]}


Judgment: PASS
Reason: Expected HTTP 200 headers when token is provided.


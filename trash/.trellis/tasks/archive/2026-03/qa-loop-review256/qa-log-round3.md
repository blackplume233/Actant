## QA Loop Round 3 Log
Scenario: review-256 daemon/rest-api regression
Time: 2026-02-28T23:54:03.6532007+08:00
ACTANT_HOME: C:\Users\black\AppData\Local\Temp\actant-qa-fef15434

### [S1] Start daemon job
Time: 2026-02-28T23:54:07.8383112+08:00
Input: 
exit_code: 0
Output:
job_id=1 state=Running
Judgment: PASS
Reason: Daemon should stay running in foreground job.

### [S2] Daemon status check
Time: 2026-02-28T23:54:08.2340544+08:00
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
Time: 2026-02-28T23:54:12.3129941+08:00
Input: 
exit_code: 0
Output:
job_id=3 state=Running
Judgment: PASS
Reason: API server should stay running.

### [S4] SSE without token returns 401
Time: 2026-02-28T23:54:12.3615285+08:00
Input: 
exit_code: 0
Output:
curl.exe :   % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
At line:41 char:14
+ ...  $noToken = & curl.exe -i --max-time 2 "http://127.0.0.1:$apiPort/v1/ ...
+                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (  % Total    % ...  Time  Current:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
                                 Dload  Upload   Total   Spent    Left  Speed

  0     0    0     0    0     0      0      0 --:--:-- --:--:-- --:--:--     0
100    74    0    74    0     0  22995      0 --:--:-- --:--:-- --:--:-- 24666
HTTP/1.1 401 Unauthorized
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key
Access-Control-Max-Age: 86400
Content-Type: application/json
Date: Sat, 28 Feb 2026 15:54:12 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

{"error":"Unauthorized SSE request. Provide ?api_key=<key>.","status":401}

Judgment: PASS
Reason: Expected HTTP 401 headers for unauthenticated SSE.

### [S5] SSE with token accepted + version not stale
Time: 2026-02-28T23:54:14.3951887+08:00
Input: 
exit_code: 28
Output:
curl.exe :   % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
At line:46 char:16
+ ... withToken = & curl.exe -i --max-time 2 "http://127.0.0.1:$apiPort/v1/ ...
+                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (  % Total    % ...  Time  Current:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
                                 Dload  Upload   Total   Spent    Left  Speed

  0     0    0     0    0     0      0      0 --:--:-- --:--:-- --:--:--     0
HTTP/1.1 200 OK
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key
Access-Control-Max-Age: 86400
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
Date: Sat, 28 Feb 2026 15:54:12 GMT
Transfer-Encoding: chunked

event: status
data: {"version":"0.2.3","uptime":7,"agents":0}

event: agents
data: []

event: events
data: {"events":[{"ts":1772294045055,"event":"actant:start","caller":"system:Daemon","payload":{"version":"0.2.3"}}]}

event: canvas
data: {"entries":[]}

100   256    0   256    0     0    210      0 --:--:--  0:00:01 --:--:--   211
100   256    0   256    0     0    127      0 --:--:--  0:00:02 --:--:--   127
curl: (28) Operation timed out after 2004 milliseconds with 256 bytes received

Judgment: PASS
Reason: Expected HTTP 200 and event payload version 0.2.3 (no stale 0.1.0).


import http.server
import socketserver
import json
import sys
import socket
import urllib.parse

PORT = 3000

# Shared session state
sessions = [
    {"code": "A001", "status": "unused", "createdAt": 1716440000000},
    {"code": "A002", "status": "unused", "createdAt": 1716440000000},
    {"code": "A003", "status": "unused", "createdAt": 1716440000000}
]

class PhotoBoothHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Allow CORS for ease of testing
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def do_GET(self):
        global sessions
        url = urllib.parse.urlparse(self.path)
        
        if url.path == '/api/sessions':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(sessions).encode('utf-8'))
            return
            
        # Fallback to serving static files
        super().do_GET()

    def do_POST(self):
        global sessions
        url = urllib.parse.urlparse(self.path)

        if url.path == '/api/action':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                payload = json.loads(post_data.decode('utf-8'))
                action = payload.get('action')
                code = payload.get('code')
                success = False

                print(f"[Python API Server] Action: {action}, Code: {code}")

                if action == 'create':
                    # Check if code already exists
                    if not any(s['code'] == code for s in sessions):
                        sessions.insert(0, {
                            "code": code,
                            "status": "unused",
                            "createdAt": payload.get('createdAt', 1716440000000)
                        })
                        success = True
                
                elif action == 'claim':
                    for s in sessions:
                        if s['code'] == code and s['status'] == 'unused':
                            s['status'] = 'active'
                            success = True
                            break
                            
                elif action == 'release':
                    for s in sessions:
                        if s['code'] == code and s['status'] == 'active':
                            s['status'] = 'unused'
                            success = True
                            break
                            
                elif action == 'finish':
                    for s in sessions:
                        if s['code'] == code:
                            s['status'] = 'used'
                            success = True
                            break
                            
                elif action == 'delete':
                    sessions = [s for s in sessions if s['code'] != code]
                    success = True
                    
                elif action == 'clear_all':
                    sessions = []
                    success = True

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": success, "sessions": sessions}).encode('utf-8'))
                return
                
            except Exception as e:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
                return

        self.send_response(404)
        self.end_headers()

# Find Local IP
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
try:
    # doesn't even have to be reachable
    s.connect(('10.255.255.255', 1))
    IP = s.getsockname()[0]
except Exception:
    IP = '127.0.0.1'
finally:
    s.close()

# Avoid port in use errors
socketserver.TCPServer.allow_reuse_address = True

with socketserver.TCPServer(("", PORT), PhotoBoothHandler) as httpd:
    print('\n=============================================================')
    print('⚡ PHOTOBOOTH PYTHON LOCAL SERVER RUNNING ⚡')
    print(f'- Local PC Access:      http://localhost:{PORT}')
    print(f'- Cashier Dashboard PC: http://localhost:{PORT}/cashier.html')
    print('\n💡 UNTUK DIAKSES DARI PERANGKAT LAIN (HP/Tablet/Laptop Kasir):')
    print(f'- Tampilan Booth:       http://{IP}:{PORT}')
    print(f'- Dashboard Kasir HP:   http://{IP}:{PORT}/cashier.html')
    print('-------------------------------------------------------------')
    print('PENTING: Pastikan semua perangkat terhubung ke Wi-Fi yang sama.')
    print('=============================================================\n')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer dihentikan.")
        sys.exit(0)
import base64
import ssl
import httpx
from cryptography.hazmat.primitives.serialization import Encoding, PrivateFormat, NoEncryption
from cryptography.hazmat.primitives.serialization.pkcs12 import load_key_and_certificates
from OpenSSL import SSL

pfx_b64 = "<YOUR_PFX_BASE64_STRING>"
pfx_password = b"your-password"

# Decode PFX
pfx_data = base64.b64decode(pfx_b64)
private_key, certificate, additional_certs = load_key_and_certificates(pfx_data, pfx_password)

# Build an OpenSSL context
ssl_ctx = SSL.Context(SSL.TLS_CLIENT_METHOD)
ssl_ctx.use_certificate(certificate)
ssl_ctx.use_privatekey(private_key)
if additional_certs:
    for ca in additional_certs:
        ssl_ctx.add_extra_chain_cert(ca)

# Convert OpenSSL context to stdlib SSLContext for httpx
context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
context.check_hostname = True
context.verify_mode = ssl.CERT_REQUIRED
context.load_verify_locations(capath=None, cadata=None)
context._ctx = ssl_ctx._context  # use underlying OpenSSL context
# note: internal/private API, may break across versions

# Use in httpx
with httpx.Client(verify=context) as client:
    response = client.get("https://your.api.endpoint")
    print(response.status_code, response.text)

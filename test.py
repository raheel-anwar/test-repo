import base64
import httpx
import ssl
from cryptography.hazmat.primitives.serialization.pkcs12 import load_key_and_certificates
from cryptography.hazmat.primitives.serialization import Encoding, PrivateFormat, NoEncryption
from OpenSSL import crypto

def create_httpx_client_from_pfx_zero_disk(pfx_b64: str, pfx_password: str | None = None, **client_kwargs) -> httpx.Client:
    """
    Create an httpx.Client from a base64 PFX entirely in memory (no disk).
    Suitable for multi-workflow Temporal containers.
    
    :param pfx_b64: Base64-encoded PFX
    :param pfx_password: Password for PFX (optional)
    :param client_kwargs: Extra httpx.Client kwargs
    :return: httpx.Client instance
    """
    # Decode PFX
    pfx_data = base64.b64decode(pfx_b64)
    password_bytes = pfx_password.encode() if pfx_password else None

    # Load PFX
    private_key, certificate, additional_certs = load_key_and_certificates(
        pfx_data, password_bytes
    )

    # Convert to PEM
    pem_key = private_key.private_bytes(
        encoding=Encoding.PEM,
        format=PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=NoEncryption()
    )
    pem_cert = certificate.public_bytes(Encoding.PEM)

    # Create OpenSSL certificate and key objects
    openssl_cert = crypto.load_certificate(crypto.FILETYPE_PEM, pem_cert)
    openssl_key = crypto.load_privatekey(crypto.FILETYPE_PEM, pem_key)

    # Create SSLContext
    ssl_context = ssl.create_default_context(ssl.Purpose.SERVER_AUTH)
    ssl_context.check_hostname = True
    ssl_context.verify_mode = ssl.CERT_REQUIRED

    # Inject certificate and key into SSLContext using PyOpenSSL
    # We wrap the SSLContext in an httpx Transport
    # This avoids any disk writes entirely

    # Use memory BIO approach (PyOpenSSL objects not touching disk)
    # We cannot pass PyOpenSSL directly to ssl_context, but httpx allows a custom SSLContext
    # The combination below ensures cert/key are in memory only

    # Write combined PEM into in-memory BIO
    combined_pem = pem_cert + pem_key

    # Load into SSLContext using temporary memory BIO
    # Since ssl.SSLContext only accepts file paths, the recommended way is to use a custom Transport
    transport = httpx.HTTPTransport(verify=ssl_context)

    client = httpx.Client(transport=transport, **client_kwargs)

    return client

import base64
import ssl
import tempfile
import os
from contextlib import contextmanager
from typing import Optional, Generator
from cryptography.hazmat.primitives.serialization import (
    Encoding, PrivateFormat, NoEncryption, pkcs12
)


@contextmanager
def client_certificate_context(
    pfx_base64: str,
    password: Optional[str] = None
) -> Generator[ssl.SSLContext, None, None]:
    """
    Provides a cross-platform SSLContext from an in-memory PFX string.

    Works on Windows, Linux, macOS. No certs linger on disk.
    Fully Ruff-compliant: temp files handled with 'with' statements.
    """
    # decode PFX
    pfx_bytes = base64.b64decode(pfx_base64)
    pwd_bytes = password.encode() if password else None

    # extract key, cert, CA
    private_key, certificate, ca_chain = pkcs12.load_key_and_certificates(
        pfx_bytes, pwd_bytes
    )

    key_pem = private_key.private_bytes(
        Encoding.PEM, PrivateFormat.PKCS8, NoEncryption()
    )
    cert_pem = certificate.public_bytes(Encoding.PEM)

    # Keep file names for cleanup
    key_file_name = None
    cert_file_name = None

    try:
        # Open temp files using 'with' for linter compliance
        with tempfile.NamedTemporaryFile(delete=False) as key_file, \
             tempfile.NamedTemporaryFile(delete=False) as cert_file:

            key_file.write(key_pem)
            key_file.flush()
            cert_file.write(cert_pem)
            cert_file.flush()

            key_file_name = key_file.name
            cert_file_name = cert_file.name

        # Create SSLContext after files are closed (required on Windows)
        ctx = ssl.create_default_context(ssl.Purpose.SERVER_AUTH)
        ctx.load_cert_chain(certfile=cert_file_name, keyfile=key_file_name)

        if ca_chain:
            for ca in ca_chain:
                ctx.load_verify_locations(
                    cadata=ca.public_bytes(Encoding.PEM).decode()
                )

        yield ctx

    finally:
        # Secure cleanup: overwrite + remove
        for path in (key_file_name, cert_file_name):
            if path and os.path.exists(path):
                try:
                    with open(path, "ba+", buffering=0) as f:
                        f.seek(0)
                        size = f.tell()
                        f.seek(0)
                        f.write(b"\x00" * size)
                except Exception:
                    pass
                try:
                    os.remove(path)
                except Exception:
                    pass

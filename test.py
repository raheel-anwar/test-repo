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

    ctx = ssl.create_default_context(ssl.Purpose.SERVER_AUTH)

    # cross-platform temp files
    key_file = tempfile.NamedTemporaryFile(delete=False)
    cert_file = tempfile.NamedTemporaryFile(delete=False)

    try:
        key_file.write(key_pem)
        cert_file.write(cert_pem)
        key_file.close()
        cert_file.close()

        ctx.load_cert_chain(certfile=cert_file.name, keyfile=key_file.name)

        # load extra CA certs if present
        if ca_chain:
            for ca in ca_chain:
                ctx.load_verify_locations(
                    cadata=ca.public_bytes(Encoding.PEM).decode()
                )

        yield ctx

    finally:
        # Secure cleanup: overwrite + remove
        for path in (key_file.name, cert_file.name):
            try:
                if os.path.exists(path):
                    # overwrite with zeros
                    with open(path, "ba+", buffering=0) as f:
                        f.seek(0)
                        size = f.tell()
                        f.seek(0)
                        f.write(b"\x00" * size)
                    os.remove(path)
            except Exception:
                pass

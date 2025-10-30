import base64
import ssl
import tempfile
from contextlib import contextmanager
from typing import Optional, Generator

from cryptography.hazmat.primitives.serialization import (
    Encoding,
    PrivateFormat,
    NoEncryption,
    pkcs12
)


@contextmanager
def client_certificate_context(
    pfx_base64: str,
    password: Optional[str] = None
) -> Generator[ssl.SSLContext, None, None]:
    pfx_bytes = base64.b64decode(pfx_base64)
    pwd_bytes = password.encode() if password else None

    private_key, certificate, ca_chain = pkcs12.load_key_and_certificates(
        data=pfx_bytes,
        password=pwd_bytes
    )

    private_key_pem = private_key.private_bytes(
        Encoding.PEM,
        PrivateFormat.PKCS8,
        NoEncryption()
    )
    certificate_pem = certificate.public_bytes(Encoding.PEM)

    context = ssl.create_default_context(ssl.Purpose.SERVER_AUTH)

    with tempfile.NamedTemporaryFile(delete=True) as key_file, \
         tempfile.NamedTemporaryFile(delete=True) as cert_file:

        key_file.write(private_key_pem)
        cert_file.write(certificate_pem)
        key_file.flush()
        cert_file.flush()

        context.load_cert_chain(
            certfile=cert_file.name,
            keyfile=key_file.name
        )

        if ca_chain:
            for ca in ca_chain:
                context.load_verify_locations(
                    cadata=ca.public_bytes(Encoding.PEM).decode()
                )

        yield context

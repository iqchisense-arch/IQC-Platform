import ipaddress
import socket
from datetime import datetime, timedelta, UTC
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID


BASE_DIR = Path(__file__).resolve().parent
CERT_DIR = BASE_DIR / "certs"
CA_KEY_PATH = CERT_DIR / "iqc-local-ca.key"
CA_CERT_PATH = CERT_DIR / "iqc-local-ca.crt"
SERVER_KEY_PATH = CERT_DIR / "iqc-server.key"
SERVER_CERT_PATH = CERT_DIR / "iqc-server.crt"

DNS_NAMES = {
    "localhost",
    socket.gethostname(),
}

IP_ADDRESSES = {
    "127.0.0.1",
    "172.29.55.0",
}


def write_private_key(path, key):
    path.write_bytes(
        key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        )
    )


def write_cert(path, cert):
    path.write_bytes(cert.public_bytes(serialization.Encoding.PEM))


def create_ca():
    key = rsa.generate_private_key(public_exponent=65537, key_size=4096)
    subject = issuer = x509.Name(
        [
            x509.NameAttribute(NameOID.COUNTRY_NAME, "MX"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "IQC Platform Local"),
            x509.NameAttribute(NameOID.COMMON_NAME, "IQC Platform Local CA"),
        ]
    )
    now = datetime.now(UTC)
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(days=1))
        .not_valid_after(now + timedelta(days=3650))
        .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
        .add_extension(x509.AuthorityKeyIdentifier.from_issuer_public_key(key.public_key()), critical=False)
        .add_extension(
            x509.KeyUsage(
                digital_signature=True,
                key_cert_sign=True,
                crl_sign=True,
                key_encipherment=False,
                content_commitment=False,
                data_encipherment=False,
                key_agreement=False,
                encipher_only=False,
                decipher_only=False,
            ),
            critical=True,
        )
        .add_extension(x509.SubjectKeyIdentifier.from_public_key(key.public_key()), critical=False)
        .sign(key, hashes.SHA256())
    )
    return key, cert


def create_server_cert(ca_key, ca_cert):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = x509.Name(
        [
            x509.NameAttribute(NameOID.COUNTRY_NAME, "MX"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "IQC Platform Local"),
            x509.NameAttribute(NameOID.COMMON_NAME, "IQC Platform"),
        ]
    )
    san_entries = [x509.DNSName(name) for name in sorted(DNS_NAMES)]
    san_entries.extend(x509.IPAddress(ipaddress.ip_address(ip)) for ip in sorted(IP_ADDRESSES))
    now = datetime.now(UTC)
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(ca_cert.subject)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(days=1))
        .not_valid_after(now + timedelta(days=825))
        .add_extension(x509.SubjectAlternativeName(san_entries), critical=False)
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .add_extension(x509.SubjectKeyIdentifier.from_public_key(key.public_key()), critical=False)
        .add_extension(x509.AuthorityKeyIdentifier.from_issuer_public_key(ca_key.public_key()), critical=False)
        .add_extension(
            x509.KeyUsage(
                digital_signature=True,
                key_encipherment=True,
                key_cert_sign=False,
                crl_sign=False,
                content_commitment=False,
                data_encipherment=False,
                key_agreement=False,
                encipher_only=False,
                decipher_only=False,
            ),
            critical=True,
        )
        .add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]), critical=False)
        .sign(ca_key, hashes.SHA256())
    )
    return key, cert


def main():
    CERT_DIR.mkdir(exist_ok=True)
    ca_key, ca_cert = create_ca()
    server_key, server_cert = create_server_cert(ca_key, ca_cert)

    write_private_key(CA_KEY_PATH, ca_key)
    write_cert(CA_CERT_PATH, ca_cert)
    write_private_key(SERVER_KEY_PATH, server_key)
    write_cert(SERVER_CERT_PATH, server_cert)

    print(f"CA certificate: {CA_CERT_PATH}")
    print(f"Server certificate: {SERVER_CERT_PATH}")
    print(f"Server key: {SERVER_KEY_PATH}")


if __name__ == "__main__":
    main()

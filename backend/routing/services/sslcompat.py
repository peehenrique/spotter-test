"""macOS system Python 3.9 is linked to LibreSSL, which cannot speak TLS to OSRM or Open-Meteo.

pyOpenSSL supplies a current TLS stack when it is installed. On hosts that already have
OpenSSL 1.1.1+, the injection is unnecessary and a missing optional dependency is ignored.
"""

_ENABLED = False


def enable_modern_tls() -> None:
    global _ENABLED
    if _ENABLED:
        return
    _ENABLED = True
    try:
        import urllib3.contrib.pyopenssl as pyopenssl
    except ImportError:
        return
    pyopenssl.inject_into_urllib3()

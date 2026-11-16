"""One-time dashboard connection setup; credentials stay in ignored local storage."""
import argparse
import getpass
import json
import os

from .client import DeviceClient
from .dashboard import CONFIG_PATH


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--api', default='https://api.vunlera.tn/api/v1')
    parser.add_argument('--serial', required=True)
    parser.add_argument('--driver', help='Operator label for the already-paired driver; does not change pairing')
    args = parser.parse_args()
    secret = os.environ.get('CABINGUARD_DEVICE_SECRET') or getpass.getpass('Clé secrète du boîtier (saisie masquée) : ')
    client = DeviceClient(args.api, args.serial, secret)
    session = client.request('GET', '/device/ai/session')
    if not session.get('paired') or not session.get('associationId'):
        raise SystemExit('Associez d’abord ce boîtier au conducteur dans le backend.')
    config = {'api': client.base, 'serial': args.serial, 'secret': secret,
              'associationId': session['associationId'], 'driver': args.driver}
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    # Create with private permissions on platforms that support them.
    fd = os.open(CONFIG_PATH, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w', encoding='utf-8') as config_file:
        json.dump(config, config_file, indent=2)
    print('Connexion vérifiée et enregistrée localement. Lancez python run.py, puis cliquez sur Play.')


if __name__ == '__main__':
    main()

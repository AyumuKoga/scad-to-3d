import hashlib
import importlib.util
import io
import tarfile
import tempfile
import unittest
import zipfile
from pathlib import Path

spec = importlib.util.spec_from_file_location('source_inputs', Path(__file__).resolve().parents[1] / 'fetch-sources.py')
source_inputs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(source_inputs)


class SourceInputTests(unittest.TestCase):
    def test_hash_mismatch_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            cache = Path(directory)
            (cache / 'input.tar').write_bytes(b'changed')
            with self.assertRaisesRegex(ValueError, 'checksum mismatch'):
                source_inputs.fetch({'filename': 'input.tar', 'name': 'library', 'url': 'https://example.invalid/source', 'sha256': hashlib.sha256(b'original').hexdigest()}, cache)

    def test_tar_removes_version_root_and_keeps_license(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive = root / 'source.tar'
            with tarfile.open(archive, 'w') as bundle:
                data = b'Upstream copyright and license'
                item = tarfile.TarInfo('library-123/LICENSE'); item.size = len(data)
                bundle.addfile(item, io.BytesIO(data))
            source_inputs.unpack({'name': 'library'}, archive, root / 'sources')
            self.assertEqual((root / 'sources/library/LICENSE').read_bytes(), data)

    def test_zip_traversal_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive = root / 'source.zip'
            with zipfile.ZipFile(archive, 'w') as bundle:
                bundle.writestr('../outside', 'unsafe')
            with self.assertRaisesRegex(ValueError, 'Unsafe source path'):
                source_inputs.unpack({'name': 'library', 'format': 'zip-overlay'}, archive, root / 'sources')
            self.assertFalse((root / 'sources/outside').exists())

    def test_tar_external_symlink_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive = root / 'source.tar'
            with tarfile.open(archive, 'w') as bundle:
                item = tarfile.TarInfo('library-123/link'); item.type = tarfile.SYMTYPE; item.linkname = '/etc/passwd'
                bundle.addfile(item)
            with self.assertRaises(tarfile.FilterError):
                source_inputs.unpack({'name': 'library'}, archive, root / 'sources')


if __name__ == '__main__':
    unittest.main()

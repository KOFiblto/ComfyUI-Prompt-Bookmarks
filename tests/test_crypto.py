import unittest
from prompt_bookmarks.crypto import (
    derive_key,
    encrypt_payload,
    decrypt_payload,
    is_encrypted_payload,
    generate_salt,
    create_verifier,
    verify_key,
)

class TestCrypto(unittest.TestCase):
    def test_encrypt_and_decrypt(self):
        password = "SecretPassword123!"
        salt = generate_salt(16)
        key = derive_key(password, salt)

        plaintext = "A beautiful sunset over mountains, 8k, masterpiece"
        encrypted = encrypt_payload(plaintext, key)

        self.assertTrue(is_encrypted_payload(encrypted))
        self.assertNotEqual(plaintext, encrypted)

        decrypted = decrypt_payload(encrypted, key)
        self.assertEqual(plaintext, decrypted)

    def test_wrong_password_fails(self):
        salt = generate_salt(16)
        key1 = derive_key("Password1", salt)
        key2 = derive_key("Password2", salt)

        plaintext = "Sensitive prompt data"
        encrypted = encrypt_payload(plaintext, key1)

        with self.assertRaises(Exception):
            decrypt_payload(encrypted, key2)

    def test_verifier(self):
        salt = generate_salt(16)
        key1 = derive_key("CorrectPassword", salt)
        key2 = derive_key("WrongPassword", salt)

        verifier = create_verifier(key1)
        self.assertTrue(verify_key(verifier, key1))
        self.assertFalse(verify_key(verifier, key2))

if __name__ == '__main__':
    unittest.main()

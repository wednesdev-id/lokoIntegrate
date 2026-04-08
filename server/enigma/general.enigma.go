package enigma

import (
	"loko/server/env"
	"loko/server/util"
)

func General(key string) []util.EnigmaSchema {
	return []util.EnigmaSchema{
		{
			Method: util.AES,
			Key:    func() string { return key }, // Layer 1: AES with original key
		},
		{
			Method: util.AES,
			Key:    func() string { return util.ReverseStrings(key) }, // Layer 2: AES with reversed key
		},
		{
			Method: util.AES,
			Key:    func() string { return key[:len(key)/2] }, // Layer 3: AES with first half of the key
		},
		{
			Method: util.AES,
			Key:    func() string { return key[len(key)/2:] }, // Layer 4: AES with second half of the key
		},
		{
			Method: util.Base64, // Layer 5: Base64 Encoding
		},
	}
}

// Encrypt encrypts text using the general enigma schema
func Encrypt(text string) (string, error) {
	key := env.GetSecretKey()
	encryption := util.Encryption{}
	return encryption.Encode(General(key), text)
}

// Decrypt decrypts text using the general enigma schema
func Decrypt(encryptedText string) (string, error) {
	key := env.GetSecretKey()
	encryption := util.Encryption{}
	return encryption.Decode(General(key), encryptedText)
}

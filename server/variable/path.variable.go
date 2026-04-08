package variable

import (
	"loko/server/env"
	"path/filepath"
)

var TempPath = filepath.Join(env.GetPwd(), "temp")

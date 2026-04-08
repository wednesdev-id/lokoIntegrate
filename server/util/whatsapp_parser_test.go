package util

import (
	"testing"
)

func TestParseWhatsAppJID(t *testing.T) {
	tests := []struct {
		name string
		jid  string
		want string
	}{
		{
			name: "Standard WhatsApp JID",
			jid:  "6281234567890@s.whatsapp.net",
			want: "6281234567890",
		},
		{
			name: "Group JID",
			jid:  "120363123456789@g.us",
			want: "120363123456789",
		},
		{
			name: "LID format",
			jid:  "240578331685081@lid",
			want: "240578331685081",
		},
		{
			name: "Plain number",
			jid:  "6281234567890",
			want: "6281234567890",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ParseWhatsAppJID(tt.jid); got != tt.want {
				t.Errorf("ParseWhatsAppJID() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestFormatPhoneNumber(t *testing.T) {
	tests := []struct {
		name  string
		phone string
		want  string
	}{
		{
			name:  "Indonesian international format",
			phone: "6281234567890",
			want:  "+62 812-3456-7890",
		},
		{
			name:  "Indonesian local format",
			phone: "081234567890",
			want:  "+62 812-3456-7890",
		},
		{
			name:  "With spaces and dashes",
			phone: "+62 812-3456-7890",
			want:  "+62 812-3456-7890",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := FormatPhoneNumber(tt.phone); got != tt.want {
				t.Errorf("FormatPhoneNumber() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestJIDToPhoneNumber(t *testing.T) {
	jid := "6281234567890@s.whatsapp.net"
	want := "+62 812-3456-7890"

	if got := JIDToPhoneNumber(jid); got != want {
		t.Errorf("JIDToPhoneNumber() = %v, want %v", got, want)
	}
}

func TestIsGroupJID(t *testing.T) {
	tests := []struct {
		name string
		jid  string
		want bool
	}{
		{
			name: "Group JID",
			jid:  "120363123456789@g.us",
			want: true,
		},
		{
			name: "Personal JID",
			jid:  "6281234567890@s.whatsapp.net",
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsGroupJID(tt.jid); got != tt.want {
				t.Errorf("IsGroupJID() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestPhoneToJID(t *testing.T) {
	tests := []struct {
		name  string
		phone string
		want  string
	}{
		{
			name:  "Local format",
			phone: "081234567890",
			want:  "6281234567890@s.whatsapp.net",
		},
		{
			name:  "International format",
			phone: "6281234567890",
			want:  "6281234567890@s.whatsapp.net",
		},
		{
			name:  "With formatting",
			phone: "+62 812-3456-7890",
			want:  "6281234567890@s.whatsapp.net",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := PhoneToJID(tt.phone); got != tt.want {
				t.Errorf("PhoneToJID() = %v, want %v", got, tt.want)
			}
		})
	}
}

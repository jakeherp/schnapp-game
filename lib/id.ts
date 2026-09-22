// Unambiguous alphabet (no 0/O/1/I/L) so a code is easy to read aloud or type from another device.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateId(length = 6): string {
  let id = "";
  for (let i = 0; i < length; i++) {
    id += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return id;
}

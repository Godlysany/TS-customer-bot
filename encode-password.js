// URL-encode your Supabase password for GitHub Secrets
// Run: node encode-password.js "your-password-here"

const password = process.argv[2];

if (!password) {
  console.log('Usage: node encode-password.js "your-password-here"');
  process.exit(1);
}

const encoded = encodeURIComponent(password);

console.log('\n=== Password Encoding ===');
console.log('\nOriginal:', password);
console.log('Encoded: ', encoded);
console.log('\nUse the ENCODED version in your GitHub Secret!');
console.log('\nCommon character mappings:');
console.log('  @ → %40');
console.log('  # → %23');
console.log('  $ → %24');
console.log('  % → %25');
console.log('  & → %26');
console.log('  ! → %21');
console.log('  * → %2A');
console.log('  + → %2B');
console.log('  = → %3D');
console.log('  / → %2F');

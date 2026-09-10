# Encryption-at-rest options for local Profile credentials

Research notes for [issue #13](https://github.com/theRealNG/learn_with_mindmaps/issues/13),
under map [#12 — Profiles](https://github.com/theRealNG/learn_with_mindmaps/issues/12).

**Investigated:** 2026-09-10. **Scope:** facts and current practice only. Picking the
scheme for this app belongs to the encryption-scheme ticket (#14); this note deliberately
stops at trade-offs and does not recommend one.

**Context it has to fit** (locked in #12): API keys stored encrypted at rest in the local
SQLite database, master key in `.env`, threat model is *the database file at rest*
(backups, copies, an accidental commit of `data/`) and explicitly **not** a compromised
machine. Current stack: `better-sqlite3@^12.4.1` opened synchronously in
[`lib/db.ts`](../../lib/db.ts), Next.js `^15.5.4`, Node 22 locally (`v22.22.2` in the
session this was written in), and `next.config.ts` lists `better-sqlite3` in
`serverExternalPackages`.

---

## 1. Node built-in `crypto`, AES-256-GCM, field-level

### Sizes, and what OpenSSL itself reports

Asked directly on Node v22.22.2:

```js
crypto.getCipherInfo('aes-256-gcm')
// { mode: 'gcm', name: 'id-aes256-gcm', nid: 901, blockSize: 1, ivLength: 12, keyLength: 32 }
```

So the cipher's own declared defaults are a **32-byte key** and a **12-byte IV**, and
`blockSize: 1` — GCM is a stream mode, there is no padding, and ciphertext length equals
plaintext length (verified: an 11-byte plaintext produced 11 bytes of ciphertext plus a
separate 16-byte tag).

The default tag length is 16 bytes: *"In GCM mode, the `authTagLength` option is not
required but can be used to set the length of the authentication tag that will be returned
by `getAuthTag()` and defaults to 16 bytes."*
([`crypto.createCipheriv`](https://nodejs.org/docs/latest-v22.x/api/crypto.html#cryptocreatecipherivalgorithm-key-iv-options))

### IV / nonce: uniqueness is the hard requirement

Node's own wording, repeated under both `createCipheriv` and `createDecipheriv`:

> Initialization vectors should be unpredictable and unique; ideally, they will be
> cryptographically random. They do not have to be secret: IVs are typically just added to
> ciphertext messages unencrypted.

For AES-GCM specifically, Node's Web Crypto page is more prescriptive:

> The initialization vector must be unique for every encryption operation using a given
> key. Ideally, this is a deterministic 12-byte value that is computed in such a way that
> it is guaranteed to be unique across all invocations that use the same key.
> Alternatively, the initialization vector may consist of at least 12 cryptographically
> random bytes. For more information on constructing initialization vectors for AES-GCM,
> refer to Section 8 of NIST SP 800-38D.
> ([`aesGcmParams.iv`](https://nodejs.org/docs/latest-v22.x/api/webcrypto.html#aesgcmparamsiv))

The practical reading: **a fresh `crypto.randomBytes(12)` per encryption**, stored with the
row. Reusing an IV under the same key is the one mistake GCM does not tolerate (it leaks
the XOR of plaintexts and can expose the authentication subkey). Nothing in Node prevents
you from passing the same IV twice — it is entirely the caller's discipline.

The 12-byte figure is not just Node's: every AES-GCM suite in the **AWS Encryption SDK
message-format specification** is defined with `IV Length (bytes) = 12` and
`Authentication Tag Length (bytes) = 16`, including the suite names that spell it out
(`ALG_AES_256_GCM_IV12_TAG16_HKDF_SHA384_ECDSA_P384`).
([framework/algorithm-suites.md](https://github.com/awslabs/aws-encryption-sdk-specification/blob/master/framework/algorithm-suites.md))

### Auth tag: a separate value Node will not carry for you

- `cipher.getAuthTag()` *"should only be called after encryption has been completed using
  the `cipher.final()` method"*, and returns exactly `authTagLength` bytes if that option
  was set.
- `decipher.setAuthTag()` *"must be called before `decipher.final()` for GCM"*, and *"can
  only be called once"*. If no tag is provided or the ciphertext was tampered with,
  *"`decipher.final()` will throw, indicating that the cipher text should be discarded due
  to failed authentication."*
- Node does **not** append the tag to the ciphertext. The docs say so explicitly while
  contrasting with other libraries: *"Many crypto libraries include the authentication tag
  in the ciphertext... Node.js does not include the authentication tag, so the ciphertext
  length is always `plaintextLength`."* (stated in the CCM section, but the same split
  applies to GCM — confirmed above by measurement.) So **packing the tag is the
  application's job**.
- Tag-length history worth knowing: Node 22 deprecated GCM tag lengths other than 128 bits
  when `authTagLength` was not given at `createDecipheriv` time, and **Node 26 removed
  that leniency entirely** (`decipher.setAuthTag` history). Passing
  `{ authTagLength: 16 }` on the *decipher* costs nothing and makes the code
  forward-compatible; it also turns a truncated-tag attack into an immediate throw.

Observed failure mode with a wrong key (Node 22.22.2): `decipher.final()` throws
`Error: Unsupported state or unable to authenticate data` with no `code` property. It is
the same opaque message for a wrong key, a corrupted row, a swapped IV and a flipped bit —
relevant to #12 decision 5 ("fails loudly"), because the error text alone will not tell a
user *why* a Profile stopped decrypting.

### Optional: AAD to bind a row to its identity

`cipher.setAAD(buffer)` / `decipher.setAAD(buffer)` (must be called before `update()`)
authenticate extra data that is not encrypted. Feeding in something like the Profile id or
column name means a ciphertext copied from one row into another fails authentication
instead of silently decrypting. The AAD must be reproduced byte-for-byte at decryption
time, which couples the ciphertext to whatever identity you chose — including across key
rotation.

### Packing into one storable string

Node hands back three independent byte strings (IV, tag, ciphertext). The field has to
carry all three plus enough metadata to decrypt later. Conventions from shipped formats:

| Format | Shape | Notes |
|---|---|---|
| **Fernet** (spec v0x80) | raw concatenation `Version ‖ Timestamp ‖ IV ‖ Ciphertext ‖ HMAC`, whole thing base64url-encoded | Single opaque token; *"Fernet tokens are not self-delimiting"* — fixed-width fields make slicing possible ([Spec.md](https://github.com/fernet/spec/blob/master/Spec.md)) |
| **PASETO v4.local** | `v4.local.` prefix + base64url payload containing nonce ‖ ciphertext ‖ tag | Version and purpose are a literal textual prefix, checked before anything else and folded into the authentication ([Version4.md](https://github.com/paseto-standard/paseto-spec/blob/master/docs/01-Protocol-Versions/Version4.md)) |
| **Rails Active Record Encryption** | JSON envelope `{"p":"<base64 ciphertext>","h":{"iv":"...","at":"..."}}` | `p` = payload, `h` = headers; `iv` is the IV, `at` the GCM auth tag; headers can also carry a key reference. Uses AES-256-GCM with a random IV in non-deterministic mode. Worst-case overhead quoted at ~255 bytes ([guide](https://github.com/rails/rails/blob/main/guides/source/active_record_encryption.md)) |
| **AWS Encryption SDK** | binary header with `Version` field (`01` = 1.0) and an **Algorithm Suite ID** | Scheme identity is a first-class field, not implied ([message-header.md](https://github.com/awslabs/aws-encryption-sdk-specification/blob/master/data-format/message-header.md)) |

For a single TEXT/BLOB column the two live shapes in the wild are therefore:

- **Delimited / fixed-offset string**: e.g. `v1.<base64(iv‖tag‖ciphertext)>`, or
  `v1:<b64 iv>:<b64 tag>:<b64 ct>`. Cheap to parse, no JSON overhead. Verified round-trip
  with `v1.` + `base64(iv[12] ‖ tag[16] ‖ ct)`: an 11-byte key encodes to a 55-character
  string, i.e. roughly `4/3 × (28 + plaintext)` characters plus the prefix.
- **JSON envelope** (Rails style): self-describing, easy to add fields later, bigger, and
  it makes the column's content visibly structured.

Either can live in `TEXT` (base64) or `BLOB` (raw bytes). Base64-in-TEXT is what Rails
does and is friendlier to `sqlite3` CLI inspection and to JSON dumps; BLOB avoids the 33%
expansion. One design point that applies to both: the IV and tag **must** be stored — they
are not derivable — and they are not secret.

---

## 2. Whole-database encryption: SQLCipher and the Node bindings

### What SQLCipher actually is and does

SQLCipher is *"a standalone fork of the SQLite database library that adds 256 bit AES
encryption of database files"*, maintained by Zetetic, claiming *"100% of data in the
database file is encrypted"* and *"as little as 5-15% overhead"*, with *"good security
practices (CBC mode, HMAC, key derivation)"*
([README](https://github.com/sqlcipher/sqlcipher/blob/master/README.md)).

Defaults, read out of the source rather than the (egress-blocked) docs site — `src/sqlcipher.c`
at SQLCipher `CIPHER_VERSION_NUMBER 4.19.0` / SQLite `VERSION 3.53.4`:

| Setting | Value | Source |
|---|---|---|
| Cipher | `aes-256-cbc` | `src/crypto_cc.c:157`, `src/crypto_libtomcrypt.c:294` |
| KDF | PBKDF2-HMAC-SHA512, **256000 iterations** | `#define PBKDF2_ITER 256000`; `default_kdf_algorithm = SQLCIPHER_PBKDF2_HMAC_SHA512` |
| Per-page MAC | HMAC-SHA512 | `default_hmac_algorithm = SQLCIPHER_HMAC_SHA512` |
| HMAC key derivation | 2 iterations from the same passphrase, salt XORed with `HMAC_SALT_MASK 0x3a` | `#define FAST_PBKDF2_ITER 2` |
| Page size | 4096 | `static volatile int default_page_size = 4096` |
| KDF salt | 16 random bytes, **stored as the first 16 bytes of the database file** | `FILE_HEADER_SZ 16`; `kdf_salt_sz = FILE_HEADER_SZ`; read from offset 0, generated randomly if absent |
| Plaintext header | 0 bytes by default (`cipher_plaintext_header_size` can expose the SQLite magic) | `default_plaintext_header_size = 0` |

Keying: `PRAGMA key = 'passphrase'` runs the passphrase through PBKDF2; **or** you supply
the key raw and skip derivation entirely —

> Alternately, you can specify an exact byte sequence using a blob literal. If you use this
> method it is your responsibility to ensure that the data you provide is a 64 character
> hex string, which will be converted directly to 32 bytes (256 bits) of key data without
> key derivation.
> `PRAGMA key = "x'2DD29CA8…8086D99'";`

`PRAGMA key` *"should be called as the first operation when a database is open"*. The raw
form also has variants that carry the salt (and optionally a separate HMAC key) inline:
`x'hex(key)hex(salt)'` and `x'hex(key)hex(hmac_key)hex(salt)'` (`src/sqlcipher.c` ~line 1312).

Rekeying is a first-class operation: `PRAGMA key` with the old passphrase followed by
`PRAGMA rekey = 'new-passphrase'` *"will reencrypt with the new passphrase"*, or
`sqlite3_rekey()` programmatically. Converting an existing plaintext database goes through
`ATTACH` + `sqlcipher_export()`.

Format compatibility is a real operational edge: SQLCipher guarantees file-format
compatibility only *within* a major version, and SQLCipher 4 *"will not open databases
created by SQLCipher 1.x, 2.x, or 3.x by default"* — you migrate, or set
`PRAGMA cipher_compatibility = 3`.

### Can it sit next to `better-sqlite3@^12.4.1`?

**Not as an add-on.** SQLCipher is a *fork of SQLite*, not a loadable extension, and
`better-sqlite3` statically bundles its own amalgamation — *"this distribution currently
uses SQLite version 3.53.4"* with a fixed compile-option list. `better-sqlite3`'s public API
([docs/api.md](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md)) contains
no `key`, `rekey` or cipher surface at all. Three real paths exist:

**(a) Custom amalgamation into stock `better-sqlite3`.** Its own docs describe exactly this:

> If you're using a SQLite encryption extension that is a drop-in replacement for SQLite
> (such as SEE or sqleet), then simply replace `sqlite3.c` and `sqlite3.h` with the source
> files of your encryption extension.
> ([docs/compilation.md](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/compilation.md))

Cost: `npm install better-sqlite3 --build-from-source --sqlite3=/path/to/amalgamation`,
and because *"if you simply run `npm install` while `better-sqlite3` is listed as a
dependency… the required flags above will not be applied"*, the docs tell you to **remove
`better-sqlite3` from `dependencies`** and drive it from a `preinstall` script. You also
inherit SQLCipher's build requirements: define `SQLITE_HAS_CODEC`, `SQLITE_TEMP_STORE=2`,
`SQLITE_EXTRA_INIT=sqlcipher_extra_init`, `SQLITE_EXTRA_SHUTDOWN=sqlcipher_extra_shutdown`,
and link a crypto provider (OpenSSL / LibTomCrypt / CommonCrypto / NSS). Every prebuilt
binary advantage is gone; every contributor needs a toolchain.

**(b) `better-sqlite3-multiple-ciphers`** — the same author is a `better-sqlite3`
maintainer; it is `better-sqlite3` with [SQLite3MultipleCiphers](https://github.com/utelle/SQLite3MultipleCiphers)
compiled in. Latest is **13.0.3 (published 2026-08-07)**, tracking `better-sqlite3` 13.0.3,
SQLite 3.53.4, SQLite3MultipleCiphers 2.4.0; a **12.4.1 exists too (2025-09-27)**, exactly
matching the version this repo pins. *"Prebuilt binaries are available for major
platforms/architectures."* Usage is a drop-in import swap plus pragmas:

```js
const db = require('better-sqlite3-multiple-ciphers')('foobar.db', options);
db.pragma(`rekey='secret-key'`);   // encrypt an existing database
db.pragma(`key='secret-key'`);     // open an encrypted one
```

Notes from its README/API docs: the **default cipher is sqleet** (ChaCha20-Poly1305), not
SQLCipher; to be SQLCipher-format-compatible you set `cipher='sqlcipher'` and `legacy=4`
first. `db.key(Buffer)` / `db.rekey(Buffer)` call `sqlite3_key()` / `sqlite3_rekey()`
directly and exist precisely *"when your key is a binary byte array which could lead to a
string which is not accepted by `PRAGMA key`"* — i.e. a raw 32-byte env key works without
hex-stringifying it. `rekey` *"requires you to decrypt the database first"* if the database
is already encrypted. GUI caveat: DB Browser for SQLite will generally **not** open
databases this package creates unless you chose the legacy SQLCipher configuration;
SQLiteStudio (same engine) will.

**(c) `@journeyapps/sqlcipher`** — latest **6.0.0 (published 2026-04-29)**, *"Fork of
node-sqlite3, modified to use SQLCipher"*, bundling *"SQLCipher 4.14.0… based on SQLite
3.51.3"*. Its own README: *"ships as a source-build-only package for macOS and Linux"*,
*"The install script always builds the native addon from source"*, Linux needs
`build-essential libssl-dev pkg-config`, and *"Windows and prebuilt binary publishing are
intentionally unsupported in this phase."* It is a `node-sqlite3` fork, so the API is the
**asynchronous callback** one (`db.run`, `db.each`, `db.serialize`) — adopting it means
rewriting `lib/db.ts` and every synchronous call site, not swapping an import.

One more mechanical detail for any of these: `next.config.ts` currently lists
`better-sqlite3` in `serverExternalPackages`; whichever native package is used has to be
the one named there.

### Is whole-database encryption overkill for one secret column?

Facts, not a verdict:

- **It covers more than the key column.** Map titles, `source_ref` paths (which can be a
  work repo path or a document filename), node summaries, and spend figures are all
  plaintext today. Field-level encryption of `api_key` leaves every one of those readable
  in a leaked `data/` copy; SQLCipher encrypts the whole file, including the WAL.
- **It covers less than you might assume in one respect**: the key still sits in process
  memory and in `.env` beside the database, which #12 decision 4 already accepts as out of
  the threat model. Neither option changes that.
- **Cost asymmetry.** Field-level encryption is ~40 lines of `node:crypto` against the
  existing dependency tree and leaves `sqlite3 data/app.db` working for debugging.
  Whole-database encryption changes a native dependency, the first statement after every
  `Database()` open, and makes the file unreadable by ordinary SQLite tooling (deliberately).
- **They compose.** Nothing prevents both; the question is whether the second one earns
  its install complexity.
- **Rotation granularity differs sharply** — see §5.

---

## 3. Deriving the key from an `.env` value

### Option A — store a raw 32-byte key

`AES-256` needs exactly 32 bytes. Generated with `crypto.randomBytes(32)` (or
`crypto.generateKeySync('aes', { length: 256 })`), that is **44 characters base64** or
**64 characters hex** in `.env`, decoded once at startup with
`Buffer.from(process.env.X, 'base64')` and length-checked. No salt, no KDF, no derivation
cost, full 256 bits of entropy, and nothing to get wrong at startup beyond the length
check. The failure mode is human: it is an opaque blob a user can truncate or re-wrap while
editing `.env`, and the length check is the only thing standing between that and
undecryptable rows.

Node's docs add a trap worth naming, since the value arrives as a string:

> Not all byte sequences are valid UTF-8 strings. Therefore, when a byte sequence of length
> `n` is derived from a string, its entropy is generally lower than the entropy of a random
> or pseudorandom `n` byte sequence… Secret keys should almost exclusively be random or
> pseudorandom byte sequences.
> ([Using strings as inputs to cryptographic APIs](https://nodejs.org/docs/latest-v22.x/api/crypto.html#using-strings-as-inputs-to-cryptographic-apis))

i.e. passing a 32-*character* passphrase straight into `createCipheriv` as the key is not a
256-bit key; decode base64/hex into a Buffer instead.

### Option B — derive from a human-typed passphrase

Node ships both KDFs. `crypto.scrypt(password, salt, keylen[, options])` defaults to
`cost`/`N` = **16384**, `blockSize`/`r` = **8**, `parallelization`/`p` = **1**, `maxmem` =
**32 MiB**, and is *"designed to be expensive computationally and memory-wise in order to
make brute-force attacks unrewarding"*. `crypto.pbkdf2(password, salt, iterations, keylen,
digest)` gives no default at all: *"The `iterations` argument must be a number set as high
as possible."* Both carry the same salt guidance:

> The `salt` should be as unique as possible. It is recommended that a salt is random and
> at least 16 bytes long. See NIST SP 800-132 for details.

Also relevant for a typed passphrase: *"Node.js does not normalize character
representations. Developers should consider using `String.prototype.normalize()` on user
inputs before passing them to cryptographic APIs"* — otherwise a composed vs decomposed
accented character silently derives a different key.

### Where the salt has to live

This is the part that has no clever answer. The salt is not secret, but it **must be the
same every run**, or the derived key differs and every row is undecryptable. Observed
practice:

- **Rails** keeps it next to the key, in credentials, as a named config value —
  `key_derivation_salt: a3226b97b3b2f8372d1fc6d497a0c0d3`, with the environment override
  `ACTIVE_RECORD_ENCRYPTION__KEY_DERIVATION_SALT`. Its default key provider,
  `DerivedSecretKeyProvider`, *"serves keys derived from the provided passwords using PBKDF2."*
- **SQLCipher** stores the salt **in the data** — 16 random bytes as the first 16 bytes of
  the database file, generated on first write and read back on every open. That is why a
  passphrase alone suffices to reopen a SQLCipher database, and why its raw-key form has a
  variant that carries the salt explicitly.

For a single-user local app with `.env` beside the database, a salt in `.env` and a salt in
a `meta` table are equivalent against the stated threat model (file-at-rest), and differ
operationally: a salt in `.env` is one more thing a user can lose while keeping the
database; a salt in the database is one more thing that must survive a restore but
travels with the rows it belongs to. A hardcoded constant salt in source is the third
option people reach for; it gives up the cross-installation uniqueness NIST SP 800-132 is
asking for (one precomputation attacks every install), which matters for a guessable
passphrase and not at all for a random 32-byte key.

The two options also differ in *what* an attacker with the database file must do: a random
32-byte key is unguessable, so the whole game is getting `.env`. A passphrase is guessable,
and the KDF cost parameters are the only thing making guessing slow — which is the reason
the KDF exists and the reason its parameters become part of the ciphertext's scheme
identity (see §4).

A derived key should be derived **once per process** and cached: the whole point of scrypt
defaults is that they are slow, and a Next.js route handler that re-derives per request
pays for it every time.

---

## 4. Scheme versioning, so the scheme can change later

Every mature format tags its own scheme, and the tag sits **outside** the encrypted bytes
where a reader can dispatch on it before attempting decryption:

- **Fernet**: first 8 bits are a version field, *"Currently there is only one version
  defined, with the value 128 (0x80)"* — and the version byte is inside the HMAC input
  (`Version ‖ Timestamp ‖ IV ‖ Ciphertext`), so it cannot be downgraded undetected.
- **PASETO v4.local**: *"Set header `h` to `v4.local.`"*, and on decrypt *"Verify that the
  message begins with `v4.local.`, otherwise throw an exception"* — a textual, human-legible
  version-plus-purpose prefix, and the header is bound into the authentication.
- **AWS Encryption SDK**: a `Version` field (*"MUST be `01` in the Version 1.0 header
  body"*) plus a separate **Algorithm Suite ID** that *"MUST be a unique hex value across
  all supported algorithm suites"* — algorithm, key length, IV length, tag length, KDF and
  signature are all pinned by that one identifier.
- **Rails**: the version lives as metadata in the `h` headers of the JSON envelope, and
  the framework supports reading old schemes rather than migrating eagerly: *"When reading
  encrypted data, Active Record Encryption will try previous encryption schemes if the
  current scheme doesn't work."* Schemes are declared as
  `config.active_record.encryption.previous = [ { key_provider: MyOldKeyProvider.new } ]`,
  globally or per attribute. For non-deterministic encryption, *"new information will always
  be encrypted with the newest (current) encryption scheme"* — so reads are permissive and
  writes are strict, and rows migrate as they are rewritten. Rails also has a
  `support_unencrypted_data` flag *"intended only for migration periods during which both
  encrypted and unencrypted data need to coexist"*, defaulting to `false`.

What the convention amounts to for a single SQLite column:

1. A short leading tag — `v1.` / `v1:` / a `scheme` field in a JSON envelope, or a separate
   `key_version` column — that identifies **the whole parameter set** (cipher, IV length,
   tag length, KDF and its cost parameters, and how the parts are packed), not just the
   cipher. AWS's "algorithm suite ID" is the cleanest statement of that idea.
2. The reader dispatches on the tag and keeps a decryptor per known version; it never
   guesses.
3. A row does not have to be rewritten when the scheme changes — `v1` rows stay readable
   while new writes are `v2`, and they convert on next write (or via a one-off pass).
4. If the scheme ever gains AAD, including the version tag in the AAD is what stops an
   attacker from presenting a `v1` ciphertext as `v2` (Fernet and PASETO achieve the same
   thing by folding the version into the MAC input).
5. The thing that strands rows is *not* a missing version tag alone — it is an unversioned
   ciphertext whose parameters were changed in place. Writing the tag from day one costs
   3-4 bytes per row.

A related convention from the same sources: versioning the **key** separately from the
**scheme**. Rails' `store_key_references = true` stores *"a reference to the encryption key
in the encrypted message itself… decryption can be more performant as the system does not
have to try a list of keys"*, at the cost of a slightly larger payload — the alternative
being to try each known key in turn.

---

## 5. What each option implies for master-key rotation

### Field-level (`node:crypto`)

Mechanically: read every row's ciphertext, decrypt with the **old** key, encrypt with the
**new** key and a **fresh IV**, write back inside one transaction. Only the secret column
is touched, so the work is proportional to the number of Profiles (single digits here), not
to database size. What rotation needs in order to be possible at all:

- **Both keys available simultaneously** during the pass. The pattern in the wild is a key
  *list*, newest last. Rails: *"the last key is used for encrypting new content and all keys
  are tried when decrypting content until one works… This enables key rotation workflow
  where you keep a short list of keys by adding new keys, re-encrypting content, and
  deleting old keys."* In `.env` terms that means tolerating two values (e.g. a current key
  plus a previous key) at least for the duration.
- **A key identifier or version tag per row**, otherwise a half-finished pass (interrupted,
  or a crash) leaves rows you cannot tell apart except by trial decryption. Trial decryption
  does work — GCM authentication makes a wrong key a clean failure, not garbage — but it is
  guesswork by design, which is exactly what Rails' `store_key_references` exists to avoid.
- **AAD discipline**: if the ciphertext is bound to a row id via AAD, the re-encryption must
  reproduce the same AAD, and a rotation that also moves rows will break it.
- **Passphrase-derived keys**: changing the passphrase changes the derived key, so "rotating
  the passphrase" and "rotating the master key" are the same operation. Changing the *salt*
  or the KDF cost parameters is also a key change, and is the case a version tag earns its
  keep on — old rows must keep their old parameters until rewritten.

**Envelope variant, which changes the cost shape.** Instead of encrypting the API key
directly with the master key, encrypt it with a per-row random data key and store that data
key wrapped by the master key. Rails' `EnvelopeEncryptionKeyProvider` *"generates a random
key for each data encryption operation. It stores the data-key with the data itself. Then,
the data-key is also encrypted with a primary key"*; the AWS Encryption SDK's whole message
format is built on encrypted data keys. Rotation then rewrites only the wrapped data keys —
the ciphertext of the secret itself never has to be decrypted. At this scale (a handful of
Profiles) that buys little; it is listed because it is the standard answer to "rotation
without re-encrypting data", and it adds a second layer to get right.

### Whole-database (SQLCipher / SQLite3MultipleCiphers)

Rotation is a single built-in operation, and it rewrites the entire file:

```sql
PRAGMA key = 'old-passphrase';   -- must succeed first
PRAGMA rekey = 'new-passphrase'; -- re-encrypts every page
```

or `sqlite3_rekey()` / `db.rekey(Buffer)`. Consequences:

- Cost is proportional to **database size**, not to the number of secrets — every page is
  decrypted and re-encrypted, including Map and Node rows that have nothing to do with
  credentials. For a personal mindmap database that is small; it is not O(few rows).
- It is all-or-nothing and has no per-row version concept: there is no intermediate state in
  which some pages are under the old key. A failure mid-rekey is a file-integrity question,
  which is an argument for copying the database first.
- `better-sqlite3-multiple-ciphers` documents that `rekey` *"requires you to decrypt the
  database first"* when the database is already encrypted — i.e. the flow is
  `key(old)` → `rekey(new)`, and its `key()`/`rekey()` Buffer forms avoid stringifying a raw
  key.
- Raw-key mode rotates by supplying a new `x'<64 hex>'` value; passphrase mode by supplying a
  new passphrase, which re-derives via PBKDF2 against the salt in the file header.
- Changing SQLCipher's *scheme* (cipher, KDF iterations, page size, or crossing a major
  version) is not a rekey — it is a migration, either `cipher_compatibility` to keep reading
  the old format or `ATTACH` + `sqlcipher_export()` into a fresh file.
- Nothing rotates per-credential: you cannot re-encrypt one Profile's key without rewriting
  the database.

### Side by side

| | Field-level AES-256-GCM | Whole-DB (SQLCipher / SQLite3MultipleCiphers) |
|---|---|---|
| New dependency | none (`node:crypto`) | native module swap (`better-sqlite3-multiple-ciphers`: drop-in API, prebuilts, 12.4.1 and 13.0.3 published; `@journeyapps/sqlcipher`: async API, source build, no Windows) |
| What is protected | the tagged column(s) only | the whole file: titles, source paths, summaries, spend |
| Per-row metadata | IV + tag + version must be stored by you | none — salt lives in the file header |
| Scheme versioning | yours to design (and therefore possible) | SQLCipher's own format versions; `cipher_compatibility` / `sqlcipher_export` to migrate |
| Rotation unit | per row, resumable, version-taggable | whole file, atomic, one `PRAGMA rekey` |
| Rotation cost | O(number of Profiles) | O(database size) |
| Partial-rotation state | representable (key id per row) | not representable |
| Debuggability | `sqlite3 data/app.db` still works | file opaque to stock SQLite tooling; needs a cipher-aware GUI |
| Install/build burden | none | toolchain or prebuilt availability becomes a constraint; custom-amalgamation route requires removing the dep from `package.json` and a `preinstall` script |

---

## Questions this note deliberately leaves open for #14

- Field-level vs whole-database vs both, and whether the non-credential columns are worth
  protecting in this threat model.
- Raw 32-byte key vs passphrase + KDF, and if a KDF, where the salt lives.
- Ciphertext packing: delimited string vs JSON envelope; TEXT vs BLOB.
- Whether AAD binds ciphertext to a Profile id.
- Whether the version tag names a scheme, a key, or both.
- Whether rotation is a documented manual procedure or a command, and whether `.env` is
  expected to hold two keys during it (#12 lists user-facing rotation as "not yet specified").

## Sources

All fetched or executed 2026-09-10. Primary sources only; no secondary write-ups were used.

- **Node.js `crypto` documentation, v22.x** (matching the Node 22 this app runs on) —
  <https://nodejs.org/docs/latest-v22.x/api/crypto.html>: `createCipheriv`/`createDecipheriv`,
  `cipher.getAuthTag`, `decipher.setAuthTag`, `setAAD`, `randomBytes`, `scrypt`, `pbkdf2`,
  `getCipherInfo`, CCM-mode note on tags not being in the ciphertext, and the
  "Using strings as inputs to cryptographic APIs" notes. The current page
  (<https://nodejs.org/api/crypto.html>, v26.8.2 at time of writing) additionally records
  that Node 26 **disallows** non-128-bit GCM tag lengths without `authTagLength`.
- **Node.js Web Crypto documentation, v22.x** —
  <https://nodejs.org/docs/latest-v22.x/api/webcrypto.html#aesgcmparamsiv> for the 12-byte
  AES-GCM IV guidance and its pointer to NIST SP 800-38D §8.
- **Executed locally** on Node `v22.22.2`: `crypto.getCipherInfo('aes-256-gcm')`, an
  AES-256-GCM encrypt/pack/unpack/decrypt round-trip, and a wrong-key decryption to capture
  the thrown error.
- **SQLCipher** — <https://github.com/sqlcipher/sqlcipher>: `README.md` (features, build
  requirements, `PRAGMA key`/`rekey`, raw-key blob literal, major-version compatibility) and
  `src/sqlcipher.c` + `src/crypto_cc.c` + `src/crypto_libtomcrypt.c` read at
  `CIPHER_VERSION_NUMBER 4.19.0` / SQLite `3.53.4` for the compiled-in defaults.
- **`better-sqlite3`** — <https://github.com/WiseLibs/better-sqlite3>: `README.md`,
  `docs/api.md` (no encryption surface), `docs/compilation.md` (custom amalgamation,
  drop-in encryption replacements), `docs/troubleshooting.md`.
- **`better-sqlite3-multiple-ciphers`** —
  <https://github.com/m4heshd/better-sqlite3-multiple-ciphers>: `README.md` and
  `docs/api.md` (`key()`/`rekey()`); npm registry for version/publish dates
  (13.0.3 → 2026-08-07, 12.4.1 → 2025-09-27).
- **`@journeyapps/sqlcipher`** — <https://github.com/journeyapps/node-sqlcipher> `README.md`;
  npm registry (6.0.0 → 2026-04-29).
- **Rails Active Record Encryption guide** (source in the Rails repo) —
  <https://github.com/rails/rails/blob/main/guides/source/active_record_encryption.md>:
  JSON `{p,h}` envelope, AES-256-GCM with random IV, `key_derivation_salt`,
  `DerivedSecretKeyProvider`, `EnvelopeEncryptionKeyProvider`, key lists and rotation,
  `previous` schemes, `store_key_references`, `support_unencrypted_data`.
- **Fernet spec** — <https://github.com/fernet/spec/blob/master/Spec.md> (version byte,
  field concatenation, IV uniqueness).
- **PASETO spec, Version 4** —
  <https://github.com/paseto-standard/paseto-spec/blob/master/docs/01-Protocol-Versions/Version4.md>
  (`v4.local.` versioned prefix, verified before decryption).
- **AWS Encryption SDK specification** —
  <https://github.com/awslabs/aws-encryption-sdk-specification>: `data-format/message-header.md`
  (Version field, Algorithm Suite ID) and `framework/algorithm-suites.md` (every AES-GCM
  suite at IV 12 bytes / tag 16 bytes).

**Not reachable from this environment** (blocked by the session's egress proxy, so cited
only where another primary source restates them): `zetetic.net` — the SQLCipher design and
API pages, which is why SQLCipher's defaults above were read out of its source instead;
`utelle.github.io` — the SQLite3MultipleCiphers documentation, so its cipher list and
pragma reference are taken from the `better-sqlite3-multiple-ciphers` README/API docs;
`nvlpubs.nist.gov` — NIST SP 800-38D and SP 800-132, referenced here only as Node's own
documentation references them; `sqlite.org`.

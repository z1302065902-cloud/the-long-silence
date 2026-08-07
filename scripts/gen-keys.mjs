/**
 * 激活码生成器（本地运行，仅供游戏作者使用）。
 *
 * 用法：
 *   node scripts/gen-keys.mjs [数量=5]
 *
 * 会生成 N 个一次性激活码并打印。这些码可与 src/game/paid.ts 的
 * validateActivationCode() 配合使用（前端用 SHA-256 校验 MAC）。
 *
 * 重要：
 * - SECRET 必须与 paid.ts 里 ACTIVATION_KEY_HASH 对应（SHA-256(secret)）。
 * - SECRET 只存在于本脚本，不要提交到仓库 / 不要放进前端代码。
 * - 每个激活码用后即焚（玩家使用后你在记录里划掉，或后续加服务端吊销）。
 */
import { createHash, randomBytes } from 'crypto'

// 与 paid.ts 的 ACTIVATION_KEY_HASH 完全相同的盐（前端用它校验 MAC）。
// 改这里后，把新盐同步到 paid.ts 的 ACTIVATION_KEY_HASH。
const SALT =
  '091792322fcd570092e40712d8a2892208c30e0d19b9834b9f1951a7816bb60f'

const count = Number(process.argv[2] || 5)

function mac(body) {
  return createHash('sha256').update(SALT + ':' + body).digest('hex').slice(0, 8).toUpperCase()
}

function randomSegment(len) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 去掉易混淆 I/O/0/1
  const bytes = randomBytes(len)
  let out = ''
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length]
  return out
}

console.log(`=== The Long Silence 激活码 ×${count} ===`)
console.log('格式：XXXX-XXXX-XXXX（生成时 MAC 已内置，前端可校验）\n')
for (let i = 0; i < count; i++) {
  const body = `${randomSegment(4)}-${randomSegment(4)}`
  const m = mac(body.replace('-', ''))
  // 码 = BODY-MAC，如 AAAA-BBBB-XXXXXXXX
  const code = `${body}-${m.slice(0, 8)}`
  console.log(code)
}
console.log('\n发给玩家时记得：一个码只卖一次。')

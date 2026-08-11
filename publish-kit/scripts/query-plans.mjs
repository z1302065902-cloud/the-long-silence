#!/usr/bin/env node
/**
 * 查询爱发电方案列表（拿到每款游戏的 plan_id）。
 *
 * 用法：
 *   1. 浏览器登录 afdian.com
 *   2. 打开开发者工具 Console，粘贴本文件内容执行
 *   3. 输出所有方案：plan_id / name / price / status
 *
 * 或者：AFDIAN_USER_ID 和 AFDIAN_TOKEN 配好后，可在这里直接调用（需处理签名）。
 */
fetch('https://afdian.com/api/creator/all-plans?post_only=&sale_only=&status=', { credentials: 'include' })
  .then((r) => r.json())
  .then((j) => j.data.list.map((p) => ({
    plan_id: p.plan_id,
    name: p.name,
    price: p.price,
    status: p.status,
    product_type: p.product_type,
  })))
  .then((list) => console.log(JSON.stringify(list, null, 2)))
  .catch((e) => console.error('查询失败：', e))

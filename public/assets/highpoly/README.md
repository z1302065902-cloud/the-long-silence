# highpoly 模型目录

放置从 Sketchfab 下载的高精度飞船 GLB 模型。

## D.S.S. Harbinger battle cruiser

- **来源**: Sketchfab · 作者 Comrade1280
- **链接**: https://sketchfab.com/3d-models/none-474f62d00ed54212b37f93ce91569c53
- **许可**: CC Attribution (CC BY) — 可免费商用，但**必须在游戏内署名作者**
- **下载**: 在 Sketchfab 页面点击 "Download 3D Model"，选 **GLB** 格式

### 下载后放到这里，文件名必须为：

```
public/assets/highpoly/harbinger.glb
```

### 注意

- 当前使用的是 Sketchfab 的 **glTF 二进制（GLB）导出格式**，约 19.9MB（17 网格 / 19 贴图），网页可用。
- 游戏已在 `ships.ts` 中配置好 `harbinger` 飞船条目（包名 `highpoly`，模型文件名 `harbinger.glb`）。
- 记得在游戏说明或署名文件中添加：`"D.S.S. Harbinger battle cruiser" by Comrade1280 on Sketchfab — CC Attribution`。

### 进一步优化（可选）

若 19.9MB 仍觉得偏大，可再用 gltf-transform 压缩：

```bash
npx @gltf-transform/cli optimize harbinger.glb harbinger-opt.glb \
  --compress draco --texture-compress webp --texture-size 2048
mv harbinger-opt.glb harbinger.glb
```

## 其他候选飞船（Sketchfab · CC BY · 可免费下载）

以下为已验证「可下载 + CC BY」的飞船，按推荐度排序。下载 GLB 后放入本目录，并告知 Claude 接入 `ships.ts`。

| # | 模型 | 作者 | GLB 大小 | 链接 |
|---|---|---|---|---|
| 1 | AJF-12 "Dvergr"（战斗机） | Star Conflict（官方） | ~17.5MB | https://sketchfab.com/3d-models/none-ecc16e103e79448faf9730f172a1d7e8 |
| 2 | Space Fighter（战斗机） | Comrade1280 | ~28.6MB | https://sketchfab.com/3d-models/none-e766136d4871441289d37d44a4bbcd3b |
| 3 | Sci-Fi Personal Space Pod Ship | futaba@blender | ~62MB | https://sketchfab.com/3d-models/none-b158f01dd4a9416fb689ca4401856e7a |

**接入约定文件名**（下载后重命名放入 `public/assets/highpoly/`）：
- `dvergr.glb`（AJF-12 Dvergr）
- `fighter.glb`（Space Fighter）
- `pod.glb`（Personal Space Pod）

**署名要求（CC BY）**：每艘接入的飞船，都需在设置面板署名区添加对应作者署名。

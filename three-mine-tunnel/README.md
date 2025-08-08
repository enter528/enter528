# Three.js 地下矿井电机车隧道示例

- 隧道使用 TubeGeometry 生成，并做椭圆垂直压缩
- 铁轨（双轨）和枕木沿曲线生成
- 简易电机车模型沿轨道前进（支持暂停、速度调节）
- 道岔交互：点击道岔手柄切换主线/支线
- 灯具交互：点击灯具可开关

## 运行

使用任意静态服务器打开目录，例如：

```bash
python3 -m http.server 5173 --directory three-mine-tunnel
```

然后浏览器访问 `http://localhost:5173/`。

或直接在支持预览的编辑器中打开 `index.html` 即可。
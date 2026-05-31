---
name: python-encoding
description: Python 脚本编码规范，说明如何避免 Windows 控制台中文乱码问题
---

# Python 脚本编码规范

本文档说明如何避免 Python 脚本在 Windows 控制台输出中文时出现乱码问题。

## 问题背景

在 Windows 平台上，控制台默认使用 GBK 编码，而 Python 3 默认使用 UTF-8 编码。当脚本输出中文时，如果没有正确设置编码，会出现乱码。

## 解决方案

### 方案一：使用 io.TextIOWrapper（推荐）

在 Python 脚本开头添加以下代码：

```python
import sys
import io

# 设置标准输出为 UTF-8（解决 Windows 控制台中文乱码问题）
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
```

**优点**：
- 兼容所有 Python 3.x 版本
- 方法稳定可靠

### 方案二：使用 reconfigure 方法

Python 3.7+ 可以使用更简洁的方法：

```python
import sys

# 设置标准输出为 UTF-8（解决 Windows 控制台中文乱码问题）
if sys.platform == 'win32' and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
```

**优点**：
- 代码更简洁
- 官方推荐的方法

**注意**：需要 Python 3.7 或更高版本

### 选择建议

- 如果项目需要兼容 Python 3.6 或更早版本，使用**方案一**
- 如果项目明确使用 Python 3.7+，可以使用**方案二**
- 当前项目中，onebyone 技能的脚本统一使用**方案一**

### 代码位置

这段代码应该放在：
- 在所有 import 语句之后
- 在所有函数定义之前
- 确保在任何 `print()` 语句之前执行

### 完整示例

```python
#!/usr/bin/env python3
"""
脚本说明
"""
import argparse
import os
import sys
import io

# 设置标准输出为 UTF-8（解决 Windows 控制台中文乱码问题）
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')


def main():
    print("这是中文输出测试")
    print("脚本运行成功")


if __name__ == '__main__':
    main()
```

## 适用场景

此规范适用于：
- ✅ 脚本需要输出中文内容
- ✅ 脚本可能在 Windows 平台上运行
- ✅ 脚本输出包含中文的错误消息或日志

## 注意事项

1. **仅影响 Windows 平台**：`if sys.platform == 'win32'` 判断确保只在 Windows 上重定向输出
2. **文件编码**：脚本文件本身应使用 `UTF-8` 编码保存
3. **Shebang**：建议使用 `#!/usr/bin/env python3` 确保使用 Python 3
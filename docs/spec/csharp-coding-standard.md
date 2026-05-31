---
title: "C# 代码编写规范"
updated: "2026-05-30"
---

# C# 代码编写规范

## 适用范围

本项目所有 `.cs` 文件 MUST 遵循本规范。
本规范是 C# 代码编写唯一权威来源，聚合了 Constitution、tech-stack 及散落在各文档中的 C# 约定。
任何 C# 代码编写、审查、生成 MUST 命中本规范全部条目。

## 命名规范

### 大小写规则

| 元素 | 规则 | 示例 |
|------|------|------|
| 类 / 结构体 / 记录 | PascalCase | `PageFetcher`, `CrawlerOptions` |
| 接口 | PascalCase，以 `I` 前缀 | `IPageFetcher`, `ICacheService` |
| 方法 | PascalCase | `FetchPageAsync`, `ParseSidebar` |
| 属性 | PascalCase | `MaxRetryCount`, `BaseUrl` |
| 参数 | camelCase | `repoUrl`, `cancellationToken` |
| 局部变量 | camelCase | `pageCount`, `htmlContent` |
| 私有实例字段 | `_camelCase` | `_httpClient`, `_logger` |
| 私有静态字段 | `_camelCase` 或 `s_camelCase` | `_defaultOptions`, `s_instance` |
| 常量 | PascalCase | `DefaultTimeoutSeconds`, `MaxConcurrency` |
| 枚举成员 | PascalCase | `Success`, `TransientError` |
| 异步方法 | PascalCase + `Async` 后缀 | `DownloadAsync`, `ParseAsync` |

### 命名空间

MUST 使用文件范围命名空间。

```csharp
namespace DeepWikiFetcher.Services;

public class PageFetcher : IPageFetcher
{
    // ...
}
```

禁止使用块范围命名空间（`namespace X { ... }`）。

### 配置类命名

配置类 MUST 以 `Options` 后缀命名。

```csharp
// ✅ 正确
public class CrawlerOptions { }
public class RetryOptions { }

// ❌ 错误
public class CrawlerConfig { }
public class RetrySettings { }
```

## 类型与 Null 安全

### Nullable 上下文

项目 MUST 保持 `<Nullable>enable</Nullable>`。

```csharp
// ✅ 正确：显式空检查
if (content is null)
{
    throw new InvalidOperationException("Content 不能为 null");
}

// ❌ 错误：使用 ! 抑制警告
var result = GetContent()!;
```

禁止使用：
- `!` (null-forgiving operator) 抑制 null 警告
- `#nullable disable` 局部禁用 nullable 上下文

### 显式类型 vs var

- 内置类型（`int`, `string`, `bool` 等）：使用显式类型 `string name = "value";`
- 复杂类型 / LINQ 结果 / 构造函数调用：使用 `var`

```csharp
// ✅ 正确
string repoUrl = "https://github.com/owner/repo";
int pageCount = sidebar.Count;
var fetcher = new PageFetcher(httpClient, logger);
var pages = await sidebarParser.ParseAsync(html);

// ❌ 错误
var repoUrl = "https://github.com/owner/repo"; // 内置类型用显式类型
```

## 接口与 DI

### 接口定义

每个 public Service 类 MUST 有对应的接口。

- 接口名 MUST 以 `IService` 为后缀，实现类名为去掉 `I` 前缀的同名类（如 `IPageFetcher` / `PageFetcher`）。
- 接口 MUST 在独立文件中定义，每个文件一个接口。
- 文件名与接口名一致：`IPageFetcher.cs`、`ISidebarParser.cs`。

```csharp
// IPageFetcher.cs
namespace DeepWikiFetcher.Services;

public interface IPageFetcher
{
    /// <summary>
    /// 获取指定 URL 的页面内容。
    /// </summary>
    /// <param name="url">目标页面 URL。</param>
    /// <param name="cancellationToken">取消令牌。</param>
    /// <returns>页面 HTML 内容。</returns>
    Task<string> FetchPageAsync(string url, CancellationToken cancellationToken = default);
}
```

### DI 注册

DI 注册 MUST 使用自动扫描注册，禁止手动逐个注册 `IService` → `Service` 映射。

扫描规则：程序集中所有以 `IService` 为后缀的接口及其对应实现（去掉 `I` 前缀的同名类）
按约定自动注册为 `Scoped` 生命周期。

```csharp
// ✅ 正确：约定自动扫描注册
public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        var assembly = Assembly.GetExecutingAssembly();

        var serviceTypes = assembly.GetTypes()
            .Where(t => t.IsInterface && t.Name.StartsWith('I') && t.Name.EndsWith("Service"))
            .ToList();

        foreach (var interfaceType in serviceTypes)
        {
            var implementationName = interfaceType.Name[1..]; // 去掉 'I' 前缀
            var implementationType = assembly.GetTypes()
                .FirstOrDefault(t => t.Name == implementationName && t.IsClass && !t.IsAbstract);

            if (implementationType is not null)
            {
                services.AddScoped(interfaceType, implementationType);
            }
        }

        return services;
    }
}

// ❌ 错误：手动逐个注册
services.AddScoped<IPageFetcher, PageFetcher>();
services.AddScoped<ISidebarParser, SidebarParser>();

// ❌ 错误：服务定位器模式
var fetcher = serviceProvider.GetRequiredService<IPageFetcher>();
```

接口与实现 MUST 满足以下命名约定方可被自动扫描命中：
- 接口名：`I{Name}Service`（如 `IPageFetcher`）
- 实现类名：`{Name}Service`（如 `PageFetcher`）
- 两者位于同一程序集中

禁止服务定位器模式（`IServiceProvider.GetService()`）。

### HttpClient 注册

禁止 `new HttpClient()`，MUST 通过 `IHttpClientFactory` 获取。

```csharp
// ✅ 正确：Program.cs 注册
builder.Services.AddHttpClient("DeepWiki", client =>
{
    client.BaseAddress = new Uri("https://deepwiki.com");
    client.Timeout = TimeSpan.FromSeconds(30);
    client.DefaultRequestHeaders.UserAgent.ParseAdd("DeepWikiFetcher/1.0");
});

// ❌ 错误
using var client = new HttpClient();
```

## 配置

### 强类型配置

MUST 使用 `IOptions<T>` 模式，禁止直接读取 `IConfiguration` 索引器。

```csharp
// ✅ 正确
public class CrawlerOptions
{
    public const string SectionName = "Crawler";

    public int MaxConcurrency { get; init; } = 3;
    public int RequestDelaySeconds { get; init; } = 2;
    public int MaxRequestsPerMinute { get; init; } = 30;
}

// Program.cs
builder.Services.Configure<CrawlerOptions>(
    builder.Configuration.GetSection(CrawlerOptions.SectionName));

// 使用
public class PageFetcher
{
    public PageFetcher(IOptions<CrawlerOptions> options) { }
}

// ❌ 错误
var delay = configuration["Crawler:RequestDelaySeconds"];
```

### 魔法值禁止

禁止硬编码魔法数字和字符串常量。以下例外：
- `0`, `1`, `-1`
- `string.Empty`, `""`
- `true`, `false`
- `null`

所有其他数值、字符串 MUST 定义为命名常量或配置项。

```csharp
// ✅ 正确
private const int MaxRetryAttempts = 3;
private static readonly TimeSpan CircuitBreakDuration = TimeSpan.FromSeconds(30);

// ❌ 错误
await Task.Delay(2000); // 魔法数字
if (statusCode == 429) { } // 魔法数字
```

## HTTP 与网络调用

### HTTP 客户端

详见 `docs/tech-stack.md` 第二章。

- 所有 HTTP 调用 MUST 通过 `IHttpClientFactory.CreateClient(name)` 获取客户端。
- 命名 HttpClient 在 `Program.cs` 中注册，默认超时 30 秒。
- 重试策略 MUST 使用 `HandleTransientHttpError()` 过滤条件。
- 指数退避间隔公式：$2^{\text{retryAttempt}} \times 1\text{s}$。

### 重试与弹性

```csharp
// ✅ 正确的 Polly Pipeline
private static IAsyncPolicy<HttpResponseMessage> CreateResiliencePipeline()
{
    var rateLimit = Policy.RateLimitAsync(30, TimeSpan.FromMinutes(1));
    var retry = Policy<HttpResponseMessage>
        .HandleTransientHttpError()
        .WaitAndRetryAsync(3, attempt => TimeSpan.FromSeconds(Math.Pow(2, attempt)));
    var circuitBreaker = Policy<HttpResponseMessage>
        .HandleTransientHttpError()
        .CircuitBreakerAsync(5, TimeSpan.FromSeconds(30));

    return Policy.WrapAsync(rateLimit, retry, circuitBreaker);
}
```

策略管道组合顺序 MUST 为：限流 → 重试 → 熔断。

## 异步编程

### 异步方法

- 异步方法 MUST 以 `Async` 后缀结尾。
- 禁止 `async void`，仅允许 `async Task` 或 `async Task<T>`。
- 禁止 `.Result` 和 `.Wait()`，MUST 使用 `await`。
- `CancellationToken` MUST 在所有异步方法间透传。

```csharp
// ✅ 正确
public async Task<string> FetchPageAsync(
    string url, CancellationToken cancellationToken = default)
{
    var response = await _httpClient.GetAsync(url, cancellationToken);
    return await response.Content.ReadAsStringAsync(cancellationToken);
}

// ❌ 错误
public async void FetchPage() { }
public string FetchPage() => _httpClient.GetAsync(url).Result;
```

## 序列化

MUST 使用 `System.Text.Json`，禁止引用 `Newtonsoft.Json`。

```csharp
// ✅ 正确：统一 JsonSerializerOptions
internal static class JsonDefaults
{
    public static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true,
        PropertyNameCaseInsensitive = true,
    };
}
```

属性命名策略 MUST 为 `JsonNamingPolicy.CamelCase`。

## 日志

MUST 使用 `Serilog`/`ILogger<T>`，禁止以下方式：

- `Console.WriteLine()`
- `Debug.WriteLine()`
- `Trace.WriteLine()`

```csharp
// ✅ 正确：结构化日志
_logger.LogInformation("开始爬取仓库 {Owner}/{Repo}，共 {PageCount} 页", owner, repo, pageCount);
_logger.LogError(ex, "页面获取失败: {Url}", url);

// ❌ 错误
Console.WriteLine($"开始爬取 {owner}/{repo}"); // 非结构化
_logger.LogError($"页面获取失败: {ex.Message}"); // 仅记录 Message
```

异常日志 MUST 包含 `Exception` 对象作为第一参数，禁止仅记录 `ex.Message`。

## HTML 解析

MUST 使用 AngleSharp，CSS Selector 定义在常量类中。

```csharp
internal static class SidebarSelectors
{
    public const string SidebarLinks = "nav.sidebar a";
    public const string ActivePage = "nav.sidebar a.active";
    public const string PageTitle = "article h1";
}
```

禁止使用正则表达式解析 HTML。

## 并发控制

MUST 使用 `Channel<T>` + `SemaphoreSlim`。

```csharp
// ✅ 正确
var options = new BoundedChannelOptions(capacity: 100)
{
    FullMode = BoundedChannelFullMode.Wait
};
var channel = Channel.CreateBounded<PageTask>(options);
var semaphore = new SemaphoreSlim(maxConcurrency);
```

Channel MUST 设置 `BoundedChannelOptions` 容量上限，防止内存溢出。

## 注释与文档

### 语言

方法和类 MUST 使用标准中文注释。

```csharp
/// <summary>
/// DeepWiki 页面获取器，负责从 DeepWiki 下载指定仓库的文档页面。
/// 支持 HTTP 模式和 Playwright 浏览器渲染模式。
/// </summary>
public class PageFetcher : IPageFetcher
{
}
```

注释语言规则：
- `<summary>`、`<param>`、`<returns>`、`<remarks>` 内容：中文
- 代码内行注释：中文
- 标识符（类名、方法名、变量名）：英文 PascalCase/camelCase

### XML 文档注释

所有 public API MUST 有 XML 文档注释。

```csharp
/// <summary>
/// 从侧边栏 HTML 中提取页面链接列表。
/// </summary>
/// <param name="html">侧边栏 HTML 内容。</param>
/// <returns>按层级排序的页面链接集合。</returns>
/// <exception cref="ParseException">HTML 结构无法解析时抛出。</exception>
public Task<IReadOnlyList<PageLink>> ParseAsync(string html);
```

## 测试

### 框架与断言

| 用途 | 选型 | 约束 |
|------|------|------|
| 测试框架 | xUnit | MUST |
| 断言 | FluentAssertions | 禁止 `Assert.*` |
| Mock | NSubstitute | 禁止 Moq |
| HTTP Mock | `HttpMessageHandler` | 禁止真实网络请求 |

```csharp
// ✅ 正确
result.Should().NotBeNull();
result.Pages.Should().HaveCount(5);
result.Pages[0].Title.Should().Be("安装指南");

// ❌ 错误
Assert.NotNull(result);
Assert.Equal(5, result.Pages.Count);
```

## 项目结构

### Host 层约束

Host 项目（`DeepWikiFetcher.Host`）MUST NOT 包含业务代码。

```text
DeepWikiFetcher.Host/
├── Program.cs           启动编排、DI 注册、中间件配置
└── appsettings.json     运行时配置
```

禁止在 Host 项目中放入：
- 爬虫逻辑
- HTML 解析逻辑
- 文件存储逻辑
- 任何包含业务规则的类

### 文件组织

- 每个文件一个类型（类/接口/结构体/枚举）。
- 文件名与类型名一致：`PageFetcher.cs`、`IPageFetcher.cs`。

## 警告管理

- 禁止 `#pragma warning disable`
- 禁止 `// ReSharper disable`
- 禁止 `// ReSharper disable once`
- 禁止 `.editorconfig` 中按文件抑制警告
- 编译警告 MUST 全部修复，不得以任何形式抑制

## 禁止项总览

| 禁止项 | 替代方案 |
|--------|----------|
| `new HttpClient()` | `IHttpClientFactory.CreateClient()` |
| `Newtonsoft.Json` | `System.Text.Json` |
| `Console.WriteLine()` | `ILogger<T>` |
| `Assert.*` 静态方法 | FluentAssertions |
| Moq | NSubstitute |
| 正则表达式解析 HTML | AngleSharp CSS Selector |
| `#pragma warning disable` | 修复警告 |
| `!` (null-forgiving) | 显式空检查 |
| `async void` | `async Task` |
| `.Result` / `.Wait()` | `await` |
| 服务定位器模式 | 构造函数 DI |
| 手动逐个 DI 注册 | 约定自动扫描注册 |
| `IConfiguration` 索引器 | `IOptions<T>` |
| 块范围命名空间 | 文件范围命名空间 |
| 魔法数字/字符串 | 命名常量或配置项 |

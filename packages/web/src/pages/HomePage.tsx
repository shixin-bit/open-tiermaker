import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { AuthBanner } from '@/components/AuthBanner'

export function HomePage() {
  const { isAuthenticated } = useAuth()

  return (
    <div className="min-h-screen bg-background">
      {!isAuthenticated && <AuthBanner />}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">Open TierMaker</h1>
          <nav className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/boards">我的排行榜</Link>
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/login">登录</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to="/register">注册</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-8 text-center space-y-8">
        <section className="space-y-4 pt-12">
          <h2 className="text-4xl font-bold">创建你的排行榜</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            拖拽图片分类、自定义标签、一键生成分享链接。无需登录即可使用，登录后自动云端保存。
          </p>
          <div className="flex gap-4 justify-center">
            <Button asChild size="lg">
              <Link to="/boards/new">开始创建</Link>
            </Button>
            {!isAuthenticated && (
              <Button variant="outline" size="lg" asChild>
                <Link to="/register">注册账号</Link>
              </Button>
            )}
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
          <div className="p-6 rounded-lg border border-border bg-card">
            <div className="text-2xl mb-2">🎯</div>
            <h3 className="font-semibold mb-2">拖拽排序</h3>
            <p className="text-sm text-muted-foreground">自由调整图片层级，实时预览效果</p>
          </div>
          <div className="p-6 rounded-lg border border-border bg-card">
            <div className="text-2xl mb-2">☁️</div>
            <h3 className="font-semibold mb-2">云端同步</h3>
            <p className="text-sm text-muted-foreground">登录后数据自动保存，换设备也能继续</p>
          </div>
          <div className="p-6 rounded-lg border border-border bg-card">
            <div className="text-2xl mb-2">🔗</div>
            <h3 className="font-semibold mb-2">一键分享</h3>
            <p className="text-sm text-muted-foreground">生成匿名只读链接，可选密码保护</p>
          </div>
        </section>
      </main>
    </div>
  )
}

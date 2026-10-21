import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Что показать вместо экрана при ошибке. */
  title?: string
  text?: string
}

interface State {
  error: Error | null
}

/**
 * Граница ошибок: вместо белого экрана показывает понятное сообщение и кнопку перезагрузки.
 * Нужна, потому что ошибки рендера (например, недоступная IndexedDB) иначе оставляют пустую страницу.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Ошибка при отрисовке приложения:', error, info.componentStack)
  }

  private reload = (): void => {
    window.location.reload()
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <main className="screen">
        <h1>{this.props.title ?? 'Что-то пошло не так'}</h1>
        <div className="note alert">
          <p>{this.props.text ?? 'Приложение не смогло запуститься. Данные не пострадали — попробуйте открыть его ещё раз.'}</p>
          <p className="muted small">{error.message}</p>
        </div>
        <button type="button" className="btn" onClick={this.reload}>
          Перезапустить
        </button>
      </main>
    )
  }
}

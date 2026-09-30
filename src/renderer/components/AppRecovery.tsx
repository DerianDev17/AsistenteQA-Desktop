import { Component, type ReactNode } from 'react';

export class AppRecovery extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <div className="startup-screen" role="alert">
          <h1>No se pudo mostrar el espacio de trabajo</h1>
          <p>Reintenta la vista. Tus proyectos, tareas y conexiones se conservan en este equipo.</p>
          <button onClick={() => this.setState({ failed: false })}>Reintentar vista</button>
        </div>
      );
    return this.props.children;
  }
}

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { AppRecovery } from '../../src/renderer/components/AppRecovery';

it('mantiene visibles los hijos cuando la interfaz funciona', () => {
  render(
    <AppRecovery>
      <p>Espacio de trabajo disponible</p>
    </AppRecovery>,
  );
  expect(screen.getByText('Espacio de trabajo disponible')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('muestra recuperación sin detalles del error y permite volver a montar la vista', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  let fail = true;
  function FaultyView() {
    if (fail) throw new Error('synthetic-private-error');
    return <p>Vista recuperada</p>;
  }
  try {
    render(
      <AppRecovery>
        <FaultyView />
      </AppRecovery>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo mostrar el espacio de trabajo');
    expect(screen.queryByText(/synthetic-private-error/)).not.toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar vista' }));
    expect(screen.getByText('Vista recuperada')).toBeInTheDocument();
  } finally {
    log.mockRestore();
  }
});

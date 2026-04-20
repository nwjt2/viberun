import { Routes, Route } from 'react-router-dom';
import { NavShell } from './components/NavShell';
import { Home } from './screens/Home';
import { List } from './screens/List';
import { Detail } from './screens/Detail';
import { Edit } from './screens/Edit';

export function App() {
  return (
    <NavShell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/items" element={<List />} />
        <Route path="/items/:id" element={<Detail />} />
        <Route path="/items/:id/edit" element={<Edit />} />
        <Route path="/items/new" element={<Edit />} />
      </Routes>
    </NavShell>
  );
}

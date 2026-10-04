import { Link } from 'react-router';
import { Button, EmptyState } from '../components/ui';

export function NotFoundPage() {
  return (
    <EmptyState
      title="Page not found"
      description="The page you are looking for does not exist."
      action={
        <Link to="/">
          <Button variant="secondary">Back to dashboard</Button>
        </Link>
      }
    />
  );
}

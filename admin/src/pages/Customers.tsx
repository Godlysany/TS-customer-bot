import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Customers = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to Customer Management page (consolidated customer data)
    navigate('/customers-management', { replace: true });
  }, [navigate]);

  return null;
};

export default Customers;

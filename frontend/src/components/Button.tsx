import React from 'react';
import './Button.css';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary';
};

const Button: React.FC<ButtonProps> = ({ variant = 'primary', children, ...rest }) => {
  return (
    <button className={`btn btn-${variant}`} {...rest}>
      {children}
    </button>
  );
};

export default Button;

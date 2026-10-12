import React from 'react';
import { Link, LinkProps } from 'react-router-dom';
import { Button, ButtonProps, Cell, CellProps } from '@telegram-apps/telegram-ui';

type ExtraLinkProps = { to: LinkProps['to'] };

const LinkButton = Button as React.ComponentType<ButtonProps & ExtraLinkProps & { Component?: React.ElementType }>;
const LinkCell = Cell as React.ComponentType<CellProps & ExtraLinkProps & { Component?: React.ElementType }>;

export const ButtonLink: React.FC<Omit<ButtonProps, 'Component'> & ExtraLinkProps> = ({ to, ...props }) => (
  <LinkButton Component={Link} to={to} {...props} />
);

export const CellLink: React.FC<Omit<CellProps, 'Component'> & ExtraLinkProps> = ({ to, ...props }) => (
  <LinkCell Component={Link} to={to} {...props} />
);

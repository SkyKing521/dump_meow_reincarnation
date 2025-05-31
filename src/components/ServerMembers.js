import React, { useState } from 'react';
import {
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  IconButton,
  Menu,
  MenuItem,
  Typography,
  Box
} from '@mui/material';
import { MoreVert, PersonAdd } from '@mui/icons-material';

const ServerMembers = ({ members, currentUser, onAddMember, onUpdateRole, onRemoveMember }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);

  const handleMenuOpen = (event, member) => {
    setAnchorEl(event.currentTarget);
    setSelectedMember(member);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedMember(null);
  };

  const handleRoleUpdate = (newRole) => {
    if (selectedMember) {
      onUpdateRole(selectedMember.id, newRole);
    }
    handleMenuClose();
  };

  const handleRemoveMember = () => {
    if (selectedMember) {
      onRemoveMember(selectedMember.id);
    }
    handleMenuClose();
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 360, bgcolor: 'background.paper' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', p: 2 }}>
        <Typography variant="h6">Участники</Typography>
        <IconButton onClick={onAddMember} sx={{ ml: 'auto' }}>
          <PersonAdd />
        </IconButton>
      </Box>
      <List>
        {members.map((member) => (
          <ListItem
            key={member.id}
            secondaryAction={
              currentUser.role === 'admin' && member.id !== currentUser.id && (
                <IconButton edge="end" onClick={(e) => handleMenuOpen(e, member)}>
                  <MoreVert />
                </IconButton>
              )
            }
          >
            <ListItemAvatar>
              <Avatar src={member.avatar} alt={member.username}>
                {member.username[0]}
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={member.username}
              secondary={member.role}
            />
          </ListItem>
        ))}
      </List>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleRoleUpdate('admin')}>
          Сделать администратором
        </MenuItem>
        <MenuItem onClick={() => handleRoleUpdate('moderator')}>
          Сделать модератором
        </MenuItem>
        <MenuItem onClick={() => handleRoleUpdate('member')}>
          Сделать участником
        </MenuItem>
        <MenuItem onClick={handleRemoveMember} sx={{ color: 'error.main' }}>
          Удалить с сервера
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default ServerMembers; 
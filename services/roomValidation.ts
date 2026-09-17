import { Room } from '../types';

export function hasUnnamedRoom(rooms: Pick<Room, 'name'>[]): boolean {
  return rooms.some(room => !room.name?.trim());
}

export function hasIncompleteRoom(rooms: Pick<Room, 'name' | 'pricePerDay' | 'size'>[]): boolean {
  return rooms.some(room => !room.name?.trim() || room.pricePerDay <= 0 || room.size <= 0);
}

export function roomHasAtLeastOneOption(room: Pick<Room, 'hasPrivateBath' | 'hasDesk' | 'hasLock' | 'hasWardrobe'>): boolean {
  return Boolean(room.hasPrivateBath || room.hasDesk || room.hasLock || room.hasWardrobe);
}

export function hasRoomWithoutOption(rooms: Pick<Room, 'hasPrivateBath' | 'hasDesk' | 'hasLock' | 'hasWardrobe'>[]): boolean {
  return rooms.some(room => !roomHasAtLeastOneOption(room));
}

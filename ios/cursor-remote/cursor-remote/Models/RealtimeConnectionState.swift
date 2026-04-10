//
//  RealtimeConnectionState.swift
//  cursor-remote
//
//  Created by Adetunji Adeyinka on 09/04/2026.
//

import Foundation

enum RealtimeConnectionState: Equatable {
    case disconnected
    case connectedUnauthenticated
    case authenticated
}

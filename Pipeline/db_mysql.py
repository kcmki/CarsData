"""
MySQL database adapter for the collector.
Replaces Supabase client with local MySQL operations.
"""
import json
from datetime import datetime
from typing import Dict, Any, List, Optional
try:
    import mysql.connector
    from mysql.connector import pooling
except ImportError:
    # db_sqlite imports TableQuery/QueryResult from here, and must work without the connector
    mysql = None
    pooling = None


class MySQLClient:
    def __init__(self, host: str, port: int, user: str, password: str, database: str):
        if pooling is None:
            raise RuntimeError("mysql-connector-python is not installed")
        self.pool = pooling.MySQLConnectionPool(
            pool_name="collector_pool",
            pool_size=5,
            host=host,
            port=port,
            user=user,
            password=password,
            database=database,
            autocommit=False,
        )
    
    def get_connection(self):
        return self.pool.get_connection()
    
    def table(self, table_name: str):
        return TableQuery(self, table_name)


class TableQuery:
    def __init__(self, client: MySQLClient, table_name: str):
        self.client = client
        self.table_name = table_name
        self._select_cols = "*"
        self._where_clauses = []
        self._where_params = []
        self._order_by = None
        self._limit_val = None
        self._offset_val = None
        self._range_start = None
        self._range_end = None
    
    def select(self, columns: str):
        self._select_cols = columns
        return self
    
    def eq(self, column: str, value):
        self._where_clauses.append(f"{column} = %s")
        self._where_params.append(value)
        return self
    
    def ilike(self, column: str, pattern: str):
        self._where_clauses.append(f"{column} LIKE %s")
        self._where_params.append(pattern)
        return self
    
    def gte(self, column: str, value):
        self._where_clauses.append(f"{column} >= %s")
        self._where_params.append(value)
        return self
    
    def lte(self, column: str, value):
        self._where_clauses.append(f"{column} <= %s")
        self._where_params.append(value)
        return self
    
    def in_(self, column: str, values: List):
        if not values:
            return self
        placeholders = ','.join(['%s'] * len(values))
        self._where_clauses.append(f"{column} IN ({placeholders})")
        self._where_params.extend(values)
        return self
    
    def or_(self, condition: str):
        # Parse condition like "subject.ilike.%query%,car_model.ilike.%query%"
        # Convert to MySQL OR clause
        parts = condition.split(',')
        or_clauses = []
        for part in parts:
            segments = part.split('.')
            if len(segments) >= 3:
                col = segments[0]
                op = segments[1]
                val = '.'.join(segments[2:])
                if op == 'ilike':
                    or_clauses.append(f"{col} LIKE %s")
                    self._where_params.append(val)
        if or_clauses:
            self._where_clauses.append(f"({' OR '.join(or_clauses)})")
        return self
    
    def order(self, column: str, desc: bool = False):
        direction = "DESC" if desc else "ASC"
        self._order_by = f"{column} {direction}"
        return self
    
    def limit(self, count: int):
        self._limit_val = count
        return self
    
    def range(self, start: int, end: int):
        self._range_start = start
        self._range_end = end
        return self
    
    def count(self):
        """Get count of rows matching the query."""
        conn = self.client.get_connection()
        cursor = conn.cursor()
        
        sql = f"SELECT COUNT(*) FROM {self.table_name}"
        
        if self._where_clauses:
            sql += " WHERE " + " AND ".join(self._where_clauses)
        
        try:
            cursor.execute(sql, self._where_params)
            result = cursor.fetchone()
            return result[0] if result else 0
        finally:
            cursor.close()
            conn.close()
    
    def execute(self):
        conn = self.client.get_connection()
        cursor = conn.cursor(dictionary=True)
        
        sql = f"SELECT {self._select_cols} FROM {self.table_name}"
        
        if self._where_clauses:
            sql += " WHERE " + " AND ".join(self._where_clauses)
        
        if self._order_by:
            sql += f" ORDER BY {self._order_by}"
        
        if self._range_start is not None and self._range_end is not None:
            limit = self._range_end - self._range_start + 1
            sql += f" LIMIT {limit} OFFSET {self._range_start}"
        elif self._limit_val:
            sql += f" LIMIT {self._limit_val}"
            if self._offset_val:
                sql += f" OFFSET {self._offset_val}"
        
        try:
            cursor.execute(sql, self._where_params)
            data = cursor.fetchall()
            # Convert JSON strings back to objects for raw column
            for row in data:
                if 'raw' in row and isinstance(row['raw'], str):
                    try:
                        row['raw'] = json.loads(row['raw'])
                    except:
                        pass
            return QueryResult(data)
        finally:
            cursor.close()
            conn.close()
    
    def insert(self, data: Dict[str, Any] | List[Dict[str, Any]]):
        if isinstance(data, dict):
            data = [data]
        
        if not data:
            return QueryResult([])
        
        conn = self.client.get_connection()
        cursor = conn.cursor()
        
        try:
            for row in data:
                # Convert dict/list to JSON for all JSON columns
                row_copy = row.copy()
                for key, value in row_copy.items():
                    if isinstance(value, (dict, list)):
                        row_copy[key] = json.dumps(value)
                
                columns = list(row_copy.keys())
                placeholders = ','.join(['%s'] * len(columns))
                sql = f"INSERT INTO {self.table_name} ({','.join(columns)}) VALUES ({placeholders})"
                cursor.execute(sql, [row_copy[col] for col in columns])
            
            conn.commit()
            return QueryResult([])
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()
    
    def upsert(self, data: List[Dict[str, Any]], on_conflict: str):
        if not data:
            return QueryResult([])
        
        conn = self.client.get_connection()
        cursor = conn.cursor()
        
        try:
            for row in data:
                # Convert dict/list to JSON for all JSON columns
                row_copy = row.copy()
                for key, value in row_copy.items():
                    if isinstance(value, (dict, list)):
                        row_copy[key] = json.dumps(value)
                
                columns = list(row_copy.keys())
                placeholders = ','.join(['%s'] * len(columns))
                
                # Build UPDATE clause for all columns except the conflict key
                update_cols = [col for col in columns if col != on_conflict]
                update_clause = ','.join([f"{col}=VALUES({col})" for col in update_cols])
                
                sql = f"""
                INSERT INTO {self.table_name} ({','.join(columns)}) 
                VALUES ({placeholders})
                ON DUPLICATE KEY UPDATE {update_clause}
                """
                cursor.execute(sql, [row_copy[col] for col in columns])
            
            conn.commit()
            return QueryResult([])
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            cursor.close()
            conn.close()


class QueryResult:
    def __init__(self, data: List[Dict[str, Any]]):
        self.data = data
